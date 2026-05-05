"""
Pure-PyTorch drop-in replacement for SAM/models/stylegan2/op/upfirdn2d.py.

The original file JIT-compiles a CUDA kernel that fails on Windows.
This replacement implements the same upsample-FIR-downsample operation
using F.pad + F.conv2d — works on CPU and GPU without compilation.
"""
import torch
import torch.nn.functional as F


def upfirdn2d(input, kernel, up=1, down=1, pad=(0, 0)):
    return upfirdn2d_native(
        input, kernel,
        up, up, down, down,
        pad[0], pad[1], pad[0], pad[1],
    )


def upfirdn2d_native(
    input, kernel,
    up_x, up_y, down_x, down_y,
    pad_x0, pad_x1, pad_y0, pad_y1,
):
    # input: [batch, channel, h, w]
    _, channel, in_h, in_w = input.shape
    kernel_h, kernel_w = kernel.shape

    # Fold channel into batch so we can use grouped conv
    # shape: [batch*channel, 1, h, w]
    x = input.reshape(-1, 1, in_h, in_w)

    # ── Upsample (insert zeros between samples) ──────────────────────────
    if up_x > 1 or up_y > 1:
        x = x.view(-1, 1, in_h, 1, in_w, 1)
        x = F.pad(x, [0, up_x - 1, 0, 0, 0, up_y - 1])
        x = x.view(-1, 1, in_h * up_y, in_w * up_x)

    # ── Pad ──────────────────────────────────────────────────────────────
    x = F.pad(
        x,
        [max(pad_x0, 0), max(pad_x1, 0), max(pad_y0, 0), max(pad_y1, 0)],
    )
    # Trim negative padding (crop)
    if pad_y0 < 0 or pad_y1 < 0 or pad_x0 < 0 or pad_x1 < 0:
        h_start = max(-pad_y0, 0)
        h_end   = x.shape[2] - max(-pad_y1, 0)
        w_start = max(-pad_x0, 0)
        w_end   = x.shape[3] - max(-pad_x1, 0)
        x = x[:, :, h_start:h_end, w_start:w_end]

    # ── FIR filter (conv2d with flipped kernel) ───────────────────────────
    w = torch.flip(kernel, [0, 1]).view(1, 1, kernel_h, kernel_w).to(dtype=x.dtype, device=x.device)
    x = F.conv2d(x, w)

    # ── Downsample ────────────────────────────────────────────────────────
    if down_x > 1 or down_y > 1:
        x = x[:, :, ::down_y, ::down_x]

    # Restore channel dim
    out_h = x.shape[2]
    out_w = x.shape[3]
    return x.view(-1, channel, out_h, out_w)
