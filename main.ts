import { new_oklab, new_rgb, rgb_to_oklab, range } from 'oklab.ts/dist/oklab'

let video = document.createElement('video')
video.muted = true
video.playsInline = true

function createCanvas() {
  let canvas = document.createElement('canvas')
  canvas.style.position = 'absolute'
  document.body.appendChild(canvas)
  let context = canvas.getContext('2d')!
  return {
    canvas,
    context,
  }
}

let rgb = new_rgb()
let oklab = new_oklab()

let colorful = true

async function init() {
  let camera = createCanvas()
  camera.canvas.title = 'full color channel'

  camera.canvas.style.inset = '0'
  camera.canvas.style.width = '100%'
  camera.canvas.style.height = '100%'

  let screen_rect = camera.canvas.getBoundingClientRect()
  console.log('screen rect:', screen_rect.width, screen_rect.height)

  function testSize() {
    let width = screen_rect.width
    let height = (video.videoHeight / video.videoWidth) * width
    let area = width * height
    let a = { width, height, area }

    height = screen_rect.height
    width = (video.videoWidth / video.videoHeight) * height
    area = width * height
    let b = { width, height, area }

    return a.area > b.area ? b : a
  }

  let stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: document.body.dataset.facing,
      width: screen_rect.width,
      height: screen_rect.height,
    },
    audio: false,
  })
  let p = new Promise(resolve => (video.onloadedmetadata = resolve))
  video.srcObject = stream
  video.play()
  await p
  console.log('video size:', video.videoWidth, video.videoHeight)
  let min_size = testSize()
  console.log('min size:', min_size.width, min_size.height)
  video.srcObject = null
  stream.getTracks().forEach(track => track.stop())

  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: document.body.dataset.facing,
      width: { min: min_size.width },
      height: { min: min_size.height },
    },
    audio: false,
  })
  p = new Promise(resolve => (video.onloadedmetadata = resolve))
  video.srcObject = stream
  video.play()
  await p
  console.log('video size:', video.videoWidth, video.videoHeight)
  let scaled_size = testSize()
  console.log('scaled size:', scaled_size.width, scaled_size.height)

  camera.canvas.width = scaled_size.width
  camera.canvas.height = scaled_size.height
  camera.canvas.style.width = scaled_size.width + 'px'
  camera.canvas.style.height = scaled_size.height + 'px'
  console.log('canvas size:', camera.canvas.width, camera.canvas.height)

  function to_full_style(canvas: HTMLCanvasElement) {
    canvas.dataset.size = 'full'
    canvas.style.width = camera.canvas.width + 'px'
    canvas.style.height = camera.canvas.height + 'px'
    canvas.style.top = '0px'
    canvas.style.left = '0px'
  }
  function to_minimap_style(color: ColorCanvas) {
    let { index, row, canvas } = color
    canvas.dataset.size = 'minimap'
    canvas.style.width = camera.canvas.width / 3 + 'px'
    canvas.style.height = camera.canvas.height / 3 + 'px'
    canvas.style.top = camera.canvas.height + (row * canvas.height) / 3 + 'px'
    canvas.style.left = (index * canvas.width) / 3 + 'px'
  }

  type ColorCanvas = ReturnType<typeof createColorCanvas>
  function createColorCanvas(index: number, _row: number) {
    let { canvas, context } = createCanvas()
    canvas.width = camera.canvas.width
    canvas.height = camera.canvas.height
    let imageData = context.createImageData(canvas.width, canvas.height)
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i + 3] = 255
    }
    function to_minimap() {
      // move color canvas
      to_minimap_style(color)

      // move camera canvas
      to_full_style(camera.canvas)
    }
    function to_full() {
      // expand current color canvas
      to_full_style(canvas)

      // move other color canvas
      let swap_row = color.row != 0
      for (let each of colors) {
        if (swap_row) {
          each.row = 1 - each.row
        }
        if (each !== color) {
          each.to_minimap()
        }
      }

      // move camera canvas
      camera.canvas.style.width = camera.canvas.width / 3 + 'px'
      camera.canvas.style.height = camera.canvas.height / 3 + 'px'
      camera.canvas.style.top = camera.canvas.height + 'px'
      camera.canvas.style.left = (index * canvas.width) / 3 + 'px'
    }
    canvas.onclick = () => {
      if (active_channel == color) {
        colorful = !colorful
        return
      }
      if (canvas.dataset.size === 'minimap') {
        // restore previous color canvas
        if (active_channel) {
          to_minimap_style(active_channel)
        }
        to_full()
        active_channel = color
      } else {
        to_minimap()
        active_channel = null
      }
    }
    function paint() {
      context.putImageData(imageData, 0, 0)
    }
    let color = {
      canvas,
      imageData,
      paint,
      to_minimap,
      to_full,
      index,
      row: _row,
    }
    to_minimap_style(color)
    return color
  }

  let active_channel: ColorCanvas | null = null

  let L_color = createColorCanvas(0, 0)
  let a_color = createColorCanvas(1, 0)
  let b_color = createColorCanvas(2, 0)

  let R_color = createColorCanvas(0, 1)
  let G_color = createColorCanvas(1, 1)
  let B_color = createColorCanvas(2, 1)

  let colors = [L_color, a_color, b_color, R_color, G_color, B_color]

  L_color.canvas.title = 'Luminance channel'
  a_color.canvas.title = 'green-red channel'
  b_color.canvas.title = 'blue-yellow channel'

  R_color.canvas.title = 'Red channel'
  G_color.canvas.title = 'Green channel'
  B_color.canvas.title = 'Blue channel'

  Object.assign(window, {
    camera,
    L_color,
    a_color,
    b_color,
    R_color,
    G_color,
    B_color,
  })

  camera.canvas.onclick = () => {
    if (active_channel) {
      to_full_style(camera.canvas)
      to_minimap_style(active_channel)
      active_channel = null
      return
    }
    if (document.body.dataset.facing === 'user') {
      document.body.dataset.facing = 'environment'
    } else {
      document.body.dataset.facing = 'user'
    }
    stop()
    start()
  }

  function stop() {
    active = false
    camera.canvas.remove()
    for (let each of colors) {
      each.canvas.remove()
    }
    stream.getTracks().forEach(track => {
      track.stop()
      stream.removeTrack(track)
    })
    video.srcObject = null
  }

  let active = true
  for (; active; ) {
    camera.context.drawImage(
      video,
      0,
      0,
      camera.canvas.width,
      camera.canvas.height,
    )
    let camera_imageData = camera.context.getImageData(
      0,
      0,
      camera.canvas.width,
      camera.canvas.height,
    )
    for (let i = 0; i < camera_imageData.data.length; i += 4) {
      rgb.r = camera_imageData.data[i + 0]
      rgb.g = camera_imageData.data[i + 1]
      rgb.b = camera_imageData.data[i + 2]
      rgb_to_oklab(rgb, oklab)

      let L = ((oklab.L - range.L.min) / range.L.range) * 255
      let a = ((oklab.a - range.a.min) / range.a.range) * 255
      let b = ((oklab.b - range.b.min) / range.b.range) * 255

      if (colorful) {
        // black to white
        L_color.imageData.data[i + 0] = L
        L_color.imageData.data[i + 1] = L
        L_color.imageData.data[i + 2] = L

        // green to red
        a_color.imageData.data[i + 0] = a
        a_color.imageData.data[i + 1] = 255 - a
        a_color.imageData.data[i + 2] = 0

        // blue to yellow
        b_color.imageData.data[i + 0] = b
        b_color.imageData.data[i + 1] = b
        b_color.imageData.data[i + 2] = 255 - b

        // black to red
        R_color.imageData.data[i + 0] = rgb.r
        R_color.imageData.data[i + 1] = 0
        R_color.imageData.data[i + 2] = 0

        // black to green
        G_color.imageData.data[i + 0] = 0
        G_color.imageData.data[i + 1] = rgb.g
        G_color.imageData.data[i + 2] = 0

        // black to blue
        B_color.imageData.data[i + 0] = 0
        B_color.imageData.data[i + 1] = 0
        B_color.imageData.data[i + 2] = rgb.b
      } else {
        // black to white
        L_color.imageData.data[i + 0] = L
        L_color.imageData.data[i + 1] = L
        L_color.imageData.data[i + 2] = L

        // green to red
        a_color.imageData.data[i + 0] = a
        a_color.imageData.data[i + 1] = a
        a_color.imageData.data[i + 2] = a

        // blue to yellow
        b_color.imageData.data[i + 0] = b
        b_color.imageData.data[i + 1] = b
        b_color.imageData.data[i + 2] = b

        // black to red
        R_color.imageData.data[i + 0] = rgb.r
        R_color.imageData.data[i + 1] = rgb.r
        R_color.imageData.data[i + 2] = rgb.r

        // black to green
        G_color.imageData.data[i + 0] = rgb.g
        G_color.imageData.data[i + 1] = rgb.g
        G_color.imageData.data[i + 2] = rgb.g

        // black to blue
        B_color.imageData.data[i + 0] = rgb.b
        B_color.imageData.data[i + 1] = rgb.b
        B_color.imageData.data[i + 2] = rgb.b
      }
    }
    L_color.paint()
    a_color.paint()
    b_color.paint()
    R_color.paint()
    G_color.paint()
    B_color.paint()
    await new Promise(resolve => requestAnimationFrame(resolve))
  }
}

function start() {
  init().catch(error => {
    alert(String(error))
  })
}

start()
