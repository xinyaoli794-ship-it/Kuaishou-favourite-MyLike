import { mkdirSync, writeFileSync } from 'node:fs'

const dir = new URL('../public/clips/', import.meta.url)
mkdirSync(dir, { recursive: true })

const clips = [
  ['flower.mp4', 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'],
  ['bbb.mp4', 'https://www.w3schools.com/html/mov_bbb.mp4'],
  ['jellyfish.mp4', 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4'],
  ['sintel.mp4', 'https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4'],
  ['bunny720.mp4', 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4']
]

for (const [name, url] of clips) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('HTTP ' + response.status)
    const buffer = Buffer.from(await response.arrayBuffer())
    writeFileSync(new URL(name, dir), buffer)
    console.log(name, buffer.length)
  } catch (error) {
    console.log('ERR', name, error.message)
  }
}
