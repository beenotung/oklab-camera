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

let camera = createCanvas()

camera.canvas.style.inset = '0'
camera.canvas.style.width = '100%'
camera.canvas.style.height = '100%'

let screen_rect = camera.canvas.getBoundingClientRect()
console.log('screen rect:', screen_rect.width, screen_rect.height)

let rgb = new_rgb()
let oklab = new_oklab()

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

async function init() {
  let stream = await navigator.mediaDevices.getUserMedia({
    video: {
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

  function createColorCanvas(index: number) {
    let { canvas, context } = createCanvas()
    canvas.width = camera.canvas.width
    canvas.height = camera.canvas.height
    let imageData = context.createImageData(canvas.width, canvas.height)
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i + 3] = 255
    }
    function to_minimap() {
      canvas.dataset.size = 'minimap'
      canvas.style.width = camera.canvas.width / 3 + 'px'
      canvas.style.height = camera.canvas.height / 3 + 'px'
      canvas.style.top = camera.canvas.height + 'px'
      canvas.style.left = (index * canvas.width) / 3 + 'px'
    }
    function to_full() {
      canvas.dataset.size = 'full'
      canvas.style.width = camera.canvas.width + 'px'
      canvas.style.height = camera.canvas.height + 'px'
      canvas.style.top = '0px'
      canvas.style.left = '0px'
      if (L_color !== color) {
        L_color.to_minimap()
      }
      if (a_color !== color) {
        a_color.to_minimap()
      }
      if (b_color !== color) {
        b_color.to_minimap()
      }
    }
    canvas.onclick = () => {
      if (canvas.dataset.size === 'minimap') {
        to_full()
      } else {
        to_minimap()
      }
    }
    function paint() {
      context.putImageData(imageData, 0, 0)
    }
    let color = { canvas, imageData, paint, to_minimap, to_full }
    return color
  }

  let L_color = createColorCanvas(0)
  let a_color = createColorCanvas(1)
  let b_color = createColorCanvas(2)

  L_color.to_minimap()
  a_color.to_minimap()
  b_color.to_minimap()

  Object.assign(window, { camera, L_color, a_color, b_color })

  for (;;) {
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
    for (let i = 0; i <= camera_imageData.data.length; i += 4) {
      rgb.r = camera_imageData.data[i + 0]
      rgb.g = camera_imageData.data[i + 1]
      rgb.b = camera_imageData.data[i + 2]
      rgb_to_oklab(rgb, oklab)

      let L = ((oklab.L - range.L.min) / range.L.range) * 255
      let a = ((oklab.a - range.a.min) / range.a.range) * 255
      let b = ((oklab.b - range.b.min) / range.b.range) * 255

      L_color.imageData.data[i + 0] = L
      L_color.imageData.data[i + 1] = L
      L_color.imageData.data[i + 2] = L

      a_color.imageData.data[i + 0] = a
      a_color.imageData.data[i + 1] = a
      a_color.imageData.data[i + 2] = a

      b_color.imageData.data[i + 0] = b
      b_color.imageData.data[i + 1] = b
      b_color.imageData.data[i + 2] = b
    }
    L_color.paint()
    a_color.paint()
    b_color.paint()
    await new Promise(resolve => requestAnimationFrame(resolve))
  }
}

init().catch(error => {
  alert(String(error))
})
