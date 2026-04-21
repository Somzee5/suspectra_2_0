'use client'

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Stage, Layer, Image as KonvaImage, Transformer, Ellipse, Rect } from 'react-konva'
import useImage from 'use-image'
import type Konva from 'konva'
import type { SketchLayer } from '@/types/sketch'

const CANVAS_W = 500
const CANVAS_H = 620

// ─── Single image layer ───────────────────────────────────────
interface ImageLayerProps {
  layer: SketchLayer
  isSelected: boolean
  onSelect: (id: string) => void
  onUpdate: (id: string, props: Partial<SketchLayer>) => void
  onRef: (id: string, node: Konva.Image | null) => void
}

function ImageLayer({ layer, isSelected, onSelect, onUpdate, onRef }: ImageLayerProps) {
  const [image] = useImage(layer.asset, 'anonymous')
  const nodeRef = useRef<Konva.Image>(null)

  useEffect(() => {
    onRef(layer.id, nodeRef.current)
    return () => onRef(layer.id, null)
  })

  // Face base renders normally; all feature layers use multiply so
  // white areas become transparent and dark pencil strokes blend naturally
  const blendMode = layer.type === 'face' ? 'source-over' : 'multiply'

  return (
    <KonvaImage
      ref={nodeRef}
      id={layer.id}
      image={image}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      rotation={layer.rotation}
      opacity={layer.opacity}
      globalCompositeOperation={blendMode}
      draggable
      onClick={() => onSelect(layer.id)}
      onTap={() => onSelect(layer.id)}
      onDragEnd={(e) => {
        onUpdate(layer.id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) })
      }}
      onTransformEnd={(e) => {
        const node = e.target as Konva.Image
        const newW = Math.max(10, Math.round(node.width() * node.scaleX()))
        const newH = Math.max(10, Math.round(node.height() * node.scaleY()))
        node.scaleX(1)
        node.scaleY(1)
        onUpdate(layer.id, {
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          width: newW,
          height: newH,
          rotation: Math.round(node.rotation()),
        })
      }}
    />
  )
}

// ─── Canvas component ─────────────────────────────────────────
export interface SketchCanvasHandle {
  exportPNG: () => void
}

interface SketchCanvasProps {
  layers: SketchLayer[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onUpdate: (id: string, props: Partial<SketchLayer>) => void
}

const SketchCanvas = forwardRef<SketchCanvasHandle, SketchCanvasProps>(
  ({ layers, selectedId, onSelect, onUpdate }, ref) => {
    const stageRef    = useRef<Konva.Stage>(null)
    const trRef       = useRef<Konva.Transformer>(null)
    const nodeMap     = useRef<Map<string, Konva.Image>>(new Map())

    // Attach transformer when selection changes
    useEffect(() => {
      const tr = trRef.current
      if (!tr) return
      if (selectedId) {
        const node = nodeMap.current.get(selectedId)
        if (node) {
          tr.nodes([node])
          tr.getLayer()?.batchDraw()
        }
      } else {
        tr.nodes([])
        tr.getLayer()?.batchDraw()
      }
    }, [selectedId, layers])

    const handleRef = (id: string, node: Konva.Image | null) => {
      if (node) nodeMap.current.set(id, node)
      else nodeMap.current.delete(id)
    }

    useImperativeHandle(ref, () => ({
      exportPNG: () => {
        const stage = stageRef.current
        if (!stage) return
        // Deselect transformer before export for clean image
        trRef.current?.nodes([])
        trRef.current?.getLayer()?.batchDraw()
        const dataURL = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' })
        const a = document.createElement('a')
        a.download = `suspectra_sketch_${Date.now()}.png`
        a.href = dataURL
        a.click()
      },
    }))

    // Sort layers by zIndex before rendering
    const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex)

    return (
      <div className="relative">
        {/* Canvas background card */}
        <div className="rounded-xl overflow-hidden shadow-2xl border border-slate-700">
          <Stage
            ref={stageRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onMouseDown={(e) => {
              // Deselect on empty background click
              if (e.target === e.target.getStage() || e.target.getType?.() === 'Stage') {
                onSelect(null)
              }
            }}
          >
            <Layer>
              {/* Paper-toned canvas background — warmer than pure white, better for pencil sketch */}
              <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#f5f0eb" />

              {/* Faint face guide oval */}
              <Ellipse
                x={250} y={310}
                radiusX={135} radiusY={188}
                stroke="#e2e8f0"
                strokeWidth={1.5}
                dash={[6, 5]}
                listening={false}
              />

              {/* Feature image layers */}
              {sortedLayers.map((layer) => (
                <ImageLayer
                  key={layer.id}
                  layer={layer}
                  isSelected={selectedId === layer.id}
                  onSelect={onSelect}
                  onUpdate={onUpdate}
                  onRef={handleRef}
                />
              ))}

              {/* Selection transformer */}
              <Transformer
                ref={trRef}
                rotateEnabled
                enabledAnchors={[
                  'top-left', 'top-center', 'top-right',
                  'middle-left', 'middle-right',
                  'bottom-left', 'bottom-center', 'bottom-right',
                ]}
                boundBoxFunc={(oldBox, newBox) =>
                  Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 8 ? oldBox : newBox
                }
              />
            </Layer>
          </Stage>
        </div>

        {/* Dimension watermark */}
        <p className="text-center text-xs text-slate-600 mt-1">
          {CANVAS_W} × {CANVAS_H} px · Sketch canvas
        </p>
      </div>
    )
  }
)

SketchCanvas.displayName = 'SketchCanvas'
export default SketchCanvas
