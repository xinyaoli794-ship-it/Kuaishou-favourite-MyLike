/**
 * 演示数据集（渲染层与主进程共用）。
 *
 * 真实版本由快手接口返回并落库；这里的数据只用于界面预览和桌面壳联调，
 * 作品、作者、时间都是虚构的。
 */
export type DemoMediaType = 'video' | 'gallery'

export type DemoEntry = [title: string, author: string, mediaType: DemoMediaType]

export const demoEntries: DemoEntry[] = [
  ['凌晨四点的码头，第一网海鲜上岸', '渔村小航', 'video'],
  ['我妈做的红烧肉，肥而不腻', '阿May的厨房', 'video'],
  ['修了二十年车，这台老捷达还有救', '老张修车', 'video'],
  ['川西的秋天，随便一拍都是壁纸', '川西在路上', 'gallery'],
  ['猫主子第一次见到雪', '小满的猫', 'video'],
  ['夜市十块钱的炒面，锅气十足', '夜市老饕', 'video'],
  ['城市凌晨两点的便利店', '城市观察员', 'video'],
  ['用废木头做了个小板凳', '木子手作', 'video'],
  ['吉他弹唱《南方姑娘》', '阿凯的吉他', 'video'],
  ['在海拔四千米看星星', '川西在路上', 'gallery'],
  ['今天做了提拉米苏', '甜点师Nina', 'video'],
  ['胶片相机拍的夏天', '阿哲的相机', 'gallery'],
  ['海边捡到的贝壳，洗干净真好看', '海边的风', 'gallery'],
  ['一杯冰美式的时间', '半糖去冰', 'video'],
  ['钓了一下午，就这条', '老李钓鱼', 'video'],
  ['给女儿画的生日贺卡', '小雨插画', 'gallery'],
  ['小城的老电影院要拆了', '小城故事', 'video'],
  ['阳台种的小番茄熟了', '阿福的菜园', 'video'],
  ['跑完第一个半马，腿已废', '跑者小周', 'video'],
  ['深夜电台：你还好吗', '深夜电台', 'video'],
  ['山里的雾散得比想象中慢', '山野阿青', 'gallery'],
  ['出海前给船刷一遍漆', '渔村小航', 'video'],
  ['教我妈用空气炸锅', '阿May的厨房', 'video'],
  ['老捷达发动机大修全过程', '老张修车', 'video'],
  ['雪后的县城，安静得像画', '小城故事', 'gallery'],
  ['橘猫和金毛抢一个纸箱', '小满的猫', 'video'],
  ['路边的糖炒栗子出锅了', '夜市老饕', 'video'],
  ['凌晨的环卫工人', '城市观察员', 'video'],
  ['做了个榫卯小书架', '木子手作', 'video'],
  ['翻唱《成都》，跑调了别笑', '阿凯的吉他', 'video'],
  ['第一次拍到银河', '阿哲的相机', 'gallery'],
  ['凌晨打烊前的一碗面', '半糖去冰', 'video'],
  ['今天的渔获有点少', '老李钓鱼', 'video'],
  ['水彩画了一整个下午', '小雨插画', 'gallery'],
  ['老电影院最后一场电影', '小城故事', 'video'],
  ['无花果熟了，摘一筐', '阿福的菜园', 'video'],
  ['雨天跑步是什么体验', '跑者小周', 'video'],
  ['读一封听众来信', '深夜电台', 'video'],
  ['雾散了，山还在', '山野阿青', 'gallery'],
  ['修船的老手艺', '渔村小航', 'video'],
  ['一个人也要好好吃饭', '阿May的厨房', 'video'],
  ['深夜改车，顺便聊聊人生', '老张修车', 'video'],
  ['村口的老槐树开花了', '小城故事', 'gallery'],
  ['给猫做了个猫爬架', '小满的猫', 'video'],
  ['试吃三种辣条，最辣的居然不是它', '夜市老饕', 'video']
]

export const demoBase = Math.floor(new Date('2026-10-20T12:00:00+08:00').getTime() / 1000)
const DAY = 86_400

/** 稳定的作品 id：快手 photo id 是数字串，这里保持同样的形态。 */
export const demoWorkId = (index: number): string => String(3_600_000_000 + index * 7)

export const demoPublishedAt = (index: number): number =>
  demoBase - index * 26 * DAY - (index % 7) * 2 * DAY - (index % 5) * 3600

export const demoFolderIds = (index: number): string[] =>
  index % 6 === 3 ? [index % 2 === 0 ? 'f-all' : 'f-food'] : []

export const demoClipName = (index: number): string =>
  ['flower', 'bbb', 'jellyfish', 'sintel', 'bunny720'][index % 5]

const palettes: [string, string, string][] = [
  ['#2a1b2f', '#6d2c4c', '#ff6488'],
  ['#10222b', '#1f5b63', '#5fd0c4'],
  ['#2b1e12', '#7a4a1f', '#ffb35c'],
  ['#1a2438', '#33477a', '#8ba6fa'],
  ['#241a1a', '#6b2f2f', '#ff8a6b'],
  ['#1d2a1e', '#38663d', '#8ede8a'],
  ['#231a2e', '#4b2f70', '#b79cff'],
  ['#2a2418', '#6d5a24', '#ffd76b']
]

const noise = (index: number, salt: number) => {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

/** 没有真实封面时，用柔光色块 + 颗粒噪点模拟视频截帧。 */
export function demoCoverSvg(index: number): string {
  const [a, b, c] = palettes[index % palettes.length]
  const x1 = 40 + noise(index, 1) * 280
  const y1 = 40 + noise(index, 2) * 260
  const x2 = 20 + noise(index, 3) * 320
  const y2 = 180 + noise(index, 4) * 280
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0.85" y2="1">
<stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
</linearGradient>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
<stop offset="0.5" stop-color="#000" stop-opacity="0"/>
<stop offset="1" stop-color="#000" stop-opacity="0.5"/>
</linearGradient>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
<feGaussianBlur stdDeviation="42"/>
</filter>
<filter id="grain">
<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/>
<feColorMatrix type="saturate" values="0"/>
</filter>
</defs>
<rect width="360" height="480" fill="url(#bg)"/>
<g filter="url(#soft)">
<ellipse cx="${x1}" cy="${y1}" rx="150" ry="120" fill="${c}" opacity="0.55"/>
<ellipse cx="${x2}" cy="${y2}" rx="170" ry="140" fill="${a}" opacity="0.6"/>
<ellipse cx="180" cy="430" rx="230" ry="120" fill="${b}" opacity="0.7"/>
</g>
<rect width="360" height="480" filter="url(#grain)" opacity="0.08"/>
<rect width="360" height="480" fill="url(#fade)"/>
</svg>`
}

export function demoCoverDataUri(index: number): string {
  return `data:image/svg+xml,${encodeURIComponent(demoCoverSvg(index))}`
}
