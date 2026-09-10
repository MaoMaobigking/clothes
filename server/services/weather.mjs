/**
 * 天气解析。
 *
 * 有 OpenWeather key 时走真实接口；没有或失败时用可解释的本地降级数据
 * （按经纬度取最近城市 + 按季节和坐标派生一个稳定的温度），
 * 保证首次进场景页不会因为外部服务抖动而卡住。
 *
 * 为什么从 services/scene/weather.mjs 提上来（2026-09-08）：
 * 现在有两个消费者 —— 场景页（services/scene/index.mjs）和 AI 工具层的
 * get_weather（services/ai/tools/handlers.mjs）。留在 scene/ 子目录下，
 * services/ai/ 就得反向依赖 services/scene/，读代码的人会以为工具依赖场景功能。
 * 它本来就不是 scene 专属的，放到 services/ 顶层和 ragService / profileService 平级。
 */
import { WEATHER_CITIES, WEATHER_CONDITIONS } from '../constants/scene.mjs'
import { config } from '../config/env.mjs'
export function seasonForMonth(month = new Date().getMonth() + 1) {
  if (month >= 3 && month <= 5) return '春季'
  if (month >= 6 && month <= 8) return '夏季'
  if (month >= 9 && month <= 11) return '秋季'
  return '冬季'
}

function roundCoord(value, digits = 4) {
  return Number(Number(value).toFixed(digits))
}

function nearestCity(latitude, longitude) {
  let best = WEATHER_CITIES[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const city of WEATHER_CITIES) {
    const dx = city.latitude - latitude
    const dy = city.longitude - longitude
    const distance = dx * dx + dy * dy
    if (distance < bestDistance) {
      bestDistance = distance
      best = city
    }
  }
  return best
}

function buildFallbackWeather(latitude, longitude, season = seasonForMonth()) {
  const city = nearestCity(latitude, longitude)
  const month = new Date().getMonth() + 1
  const index = Math.abs(Math.round(latitude + longitude + month * 7)) % WEATHER_CONDITIONS.length
  const weather = WEATHER_CONDITIONS[index]
  const tempBase = {
    春季: 18,
    夏季: 30,
    秋季: 20,
    冬季: 6,
  }
  const temp = (tempBase[season] ?? 18) + (index % 3)
  return {
    city: city.name,
    temp,
    condition: weather.condition,
    icon: weather.icon,
    season,
    source: 'fallback',
    latitude: roundCoord(latitude),
    longitude: roundCoord(longitude),
  }
}

async function fetchWeatherWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`天气接口 ${response.status}`)
    }
    return response.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 定位天气。有 OpenWeather key 时尝试真实接口；没有或失败时使用可解释的
 * 本地降级数据，保证首次进入场景页不会因外部服务失败而阻断。
 */
export async function resolveWeather(input = {}) {
  const latitude = Number(input.latitude)
  const longitude = Number(input.longitude)
  const season = input.season || seasonForMonth()
  //isFinite的作用是判断是否为一个合格的有限数据
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      city: input.city || '杭州',
      temp: Number(input.temp) || 20,
      condition: input.condition || '多云',
      icon: input.icon || '⛅',
      season,
      source: 'manual',
    }
  }

  const fallback = buildFallbackWeather(latitude, longitude, season)
  const apiKey = config.weather.openWeatherKey
  if (!apiKey) return fallback

  try {
    const url =
      'https://api.openweathermap.org/data/2.5/weather' +
      `?lat=${latitude}&lon=${longitude}&units=metric&lang=zh_cn&appid=${apiKey}`
    const data = await fetchWeatherWithTimeout(url)
    return {
      city: data.name || fallback.city,
      temp: Math.round(Number(data.main?.temp)),
      condition: data.weather?.[0]?.description || fallback.condition,
      icon: data.weather?.[0]?.main || fallback.icon,
      season,
      source: 'located',
      latitude: roundCoord(latitude),
      longitude: roundCoord(longitude),
    }
  } catch (error) {
    console.warn('[weatherService] 真实天气接口不可用，使用定位降级:', error.message)
    return fallback
  }
}

/**
 * 按城市名查天气。给 AI 工具层的 get_weather 用 —— 模型传来的是城市名，不是经纬度。
 *
 * 三级：
 *   1. 命中 constants/scene.mjs 的 WEATHER_CITIES（5 个常用城市自带经纬度）→ 直接走 resolveWeather
 *   2. 没命中但配了 key → OpenWeather 的 geocoding 换经纬度，再走 resolveWeather
 *   3. 都不行 → 按杭州坐标出降级数据，但把城市名换成用户问的那个
 *
 * 任何情况都不抛：工具执行失败会打断整个 tool-calling 循环，
 * 天气查不到不该让整轮对话崩掉。返回值里的 source 会说明这条数据是真的还是降级的。
 */
export async function resolveWeatherByCity(cityName) {
  const name = String(cityName || '').trim()
  if (!name) return resolveWeather({})

  const known = WEATHER_CITIES.find((c) => c.name === name || name.includes(c.name))
  if (known) {
    return resolveWeather({ latitude: known.latitude, longitude: known.longitude })
  }

  const apiKey = config.weather.openWeatherKey
  if (apiKey) {
    try {
      const url =
        'https://api.openweathermap.org/geo/1.0/direct' + `?q=${encodeURIComponent(name)}&limit=1&appid=${apiKey}`
      const list = await fetchWeatherWithTimeout(url)
      const hit = Array.isArray(list) ? list[0] : null
      if (hit) {
        const weather = await resolveWeather({ latitude: hit.lat, longitude: hit.lon })
        // geocoding 返回的英文名（Chongqing）不如用户问的中文名可读，保留用户的说法
        return { ...weather, city: name }
      }
    } catch (error) {
      console.warn('[weatherService] 城市地理编码失败，使用降级:', error.message)
    }
  }

  const hangzhou = WEATHER_CITIES[0]
  const fallback = buildFallbackWeather(hangzhou.latitude, hangzhou.longitude)
  return { ...fallback, city: name }
}
