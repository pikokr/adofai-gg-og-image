import { VercelRequest, VercelResponse } from "@vercel/node"
import * as yup from "yup"
import path from "path"
import { Canvas, Image, loadImage } from "canvas"

const assetsDir = path.join(__dirname, "../assets")

const difficultyIconCache = new Map<number, Image>()

let logo: Image | null = null

/**
 * By Ken Fyrstenberg Nilsen
 *
 * drawImageProp(context, image [, x, y, width, height [,offsetX, offsetY]])
 *
 * If image and context are only arguments rectangle will equal canvas
 */
function drawImageProp(
  ctx: any,
  img: any,
  x: any,
  y: any,
  w: any,
  h: any,
  offsetX?: any,
  offsetY?: any,
) {
  if (arguments.length === 2) {
    x = y = 0
    w = ctx.canvas.width
    h = ctx.canvas.height
  }

  // default offset is center
  offsetX = typeof offsetX === "number" ? offsetX : 0.5
  offsetY = typeof offsetY === "number" ? offsetY : 0.5

  // keep bounds [0.0, 1.0]
  if (offsetX < 0) offsetX = 0
  if (offsetY < 0) offsetY = 0
  if (offsetX > 1) offsetX = 1
  if (offsetY > 1) offsetY = 1

  let iw = img.width,
    ih = img.height,
    r = Math.min(w / iw, h / ih),
    nw = iw * r, // new prop. width
    nh = ih * r, // new prop. height
    cx,
    cy,
    cw,
    ch,
    ar = 1

  // decide which gap to fill
  if (nw < w) ar = w / nw
  if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh // updated
  nw *= ar
  nh *= ar

  // calc source rectangle
  cw = iw / (nw / w)
  ch = ih / (nh / h)

  cx = (iw - cw) * offsetX
  cy = (ih - ch) * offsetY

  // make sure source rectangle is valid
  if (cx < 0) cx = 0
  if (cy < 0) cy = 0
  if (cw > iw) cw = iw
  if (ch > ih) ch = ih

  // fill image in dest. rectangle
  ctx.drawImage(img, cx, cy, cw, ch, x, y, w, h)
}

async function getLogo() {
  if (logo) return logo
  logo = await loadImage(path.join(assetsDir, "icon.png"))
  return logo
}

async function getDifficultyIcon(lvl: number) {
  const get = difficultyIconCache.get(lvl)
  if (get) return get
  try {
    const img = await loadImage(
      path.join(assetsDir, "difficulty_icons", `${lvl}.svg`),
    )
    difficultyIconCache.set(lvl, img)
    return img
  } catch (e: any) {
    return null
  }
}

const levelSchema = yup.object().shape({
  thumbnail: yup.string().required(),
  difficulty: yup.number().required(),
})

const handle = async (req: VercelRequest, res: VercelResponse) => {
  try {
    const data = await levelSchema.validate(req.query)

    const width = 1280
    const height = 720

    const canvas = new Canvas(width, height)

    const ctx = canvas.getContext("2d")

    const background = await loadImage(data.thumbnail)

    const lvlIcon = await getDifficultyIcon(data.difficulty)

    if (!lvlIcon) {
      return res.status(400).json({ error: "Unknown difficulty" })
    }

    drawImageProp(ctx, background, 0, 0, width, height)

    // ctx.drawImage(background, 0, 0, 1280, 720)

    ctx.drawImage(lvlIcon, 20, height - 20 - 120, 120, 120)
    ctx.drawImage(await getLogo(), width - 20 - 70, 20, 70, 70)

    res.setHeader("Content-Type", "image/png")

    res.status(200).send(canvas.toBuffer())
  } catch (e) {
    res.status(500).json(e)
  }
}

export default handle
