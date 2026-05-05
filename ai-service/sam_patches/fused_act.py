"""
Pure-PyTorch drop-in replacement for SAM/models/stylegan2/op/fused_act.py.

The original file JIT-compiles fused_bias_act CUDA kernels via
torch.utils.cpp_extension.load(), which fails on Windows with
"DLL load failed" because the compiled .pyd depends on MSVC / CUDA
runtime DLLs that are not guaranteed to be in PATH.

This replacement implements identical math using only built-in PyTorch ops.
No compilation, no DLLs, works on Windows / macOS / Linux / CPU / GPU.
"""
import torch
import torch.nn as nn
import torch.nn.functional as F


class FusedLeakyReLU(nn.Module):
    def __init__(self, channel, bias=True, negative_slope=0.2, scale=2 ** 0.5):
        super().__init__()
        self.bias = nn.Parameter(torch.zeros(channel)) if bias else None
        self.negative_slope = negative_slope
        self.scale = scale

    def forward(self, input):
        return fused_leaky_relu(input, self.bias, self.negative_slope, self.scale)


def fused_leaky_relu(input, bias=None, negative_slope=0.2, scale=2 ** 0.5):
    if bias is not None:
        # Reshape bias to [1, C, 1, 1, ...] so it broadcasts over spatial dims
        rest = [1] * (input.ndim - 2)
        input = input + bias.view(1, -1, *rest)
    return F.leaky_relu(input, negative_slope=negative_slope) * scale
