import { ref, nextTick } from 'vue'
import { startSpan } from '@/utils/performance'
import { isAuthError } from '@/utils/request'
import { onShow } from '@dcloudio/uni-app'
import { fetchScenePlans, fetchSceneWeather, type ScenePlan } from '@/api/scene'
import { resolveImageUrl } from '@/api/wardrobe'

/** 首页和 AI 页共享真实衣橱推荐；空衣橱与请求失败都不填充演示搭配。 */
export function useHomeFeed(withWeather = false) {
  const recommendations = ref<ScenePlan[]>([])
  const loading = ref(false)
  const error = ref('')
  const temperature = ref<number | null>(null)
  const weatherLabel = ref('点击获取天气')
  const weatherLoading = ref(false)

  async function load() {
    if (loading.value) return
    const end = startSpan('recommendations_ready')
    loading.value = true
    error.value = ''
    recommendations.value = []
    try {
      const data = await fetchScenePlans({ sceneKey: 'subway', season: '' })
      recommendations.value = data.plans.pure
        .filter((plan) => plan.items.length > 0)
        .map((plan) => ({
          ...plan,
          items: plan.items.map((item) => ({ ...item, imageUrl: resolveImageUrl(item.imageUrl) || '' })),
        }))
      await nextTick()
      end()
    } catch (cause) {
      end(false, { outcome: isAuthError(cause) ? 'abandoned' : 'error' })
      error.value = '搭配加载失败，点击重试'
    } finally {
      loading.value = false
    }
  }

  async function loadWeather() {
    if (!withWeather || weatherLoading.value) return
    weatherLoading.value = true
    temperature.value = null
    weatherLabel.value = '正在获取天气…'
    try {
      const position = await new Promise<UniApp.GetLocationSuccess>((resolve, reject) =>
        uni.getLocation({ type: 'wgs84', success: resolve, fail: reject }),
      )
      const weather = await fetchSceneWeather({
        latitude: position.latitude,
        longitude: position.longitude,
      })
      // 季节推算值不冒充实况温度。
      if (weather.source !== 'located' || !Number.isFinite(weather.temp)) {
        weatherLabel.value = '实况天气暂不可用'
      } else {
        temperature.value = weather.temp
        weatherLabel.value = `${weather.city} ${weather.condition}`
      }
    } catch {
      weatherLabel.value = '定位或天气不可用，点击重试'
    } finally {
      weatherLoading.value = false
    }
  }

  onShow(load)
  return { recommendations, loading, error, load, temperature, weatherLabel, loadWeather }
}
