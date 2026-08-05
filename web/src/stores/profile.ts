import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  BODY_FIELDS,
  FACE_OPTIONS,
  PREFERENCE_QUESTIONS,
  SKIN_OPTIONS,
  STEPS,
  STYLE_OPTIONS,
} from '@/data/questions'
import type { BodyMetricKey, Gender, HairStyleId, RadarDimension, UserProfile } from '@/types'

const PROFILE_STORAGE_KEY = 'ai-fashion-profile'

/** 体型的初始值：用每一项的 default 填充 */
function defaultBody(): Record<BodyMetricKey, number> {
  return BODY_FIELDS.reduce(
    (acc, f) => {
      acc[f.key] = f.default
      return acc
    },
    {} as Record<BodyMetricKey, number>,
  )
}

/** 脸型 -> 示意得分（仅用于雷达图展示） */
const FACE_SCORE: Record<string, number> = {
  oval: 95,
  heart: 88,
  diamond: 84,
  square: 80,
  round: 78,
  long: 76,
}

export const useProfileStore = defineStore('profile', () => {
  /** 当前第几步（1 ~ 5） */
  const currentStep = ref(1)

  /** 用户画像数据 */
  const profile = reactive<UserProfile>({
    styles: [],
    skinTone: '',
    faceShape: '',
    body: defaultBody(),
    preferences: {},
    gender: 'female',
    hairstyle: 'straight',
  })

  const totalSteps = STEPS.length

  /* ---------------- 修改数据的动作 ---------------- */

  /** 风格：点一下切换选中；已选够 6 项时再点会取消 */
  function toggleStyle(id: string) {
    const i = profile.styles.indexOf(id)
    if (i >= 0) profile.styles.splice(i, 1)
    else profile.styles.push(id)
  }

  function setSkin(id: string) {
    profile.skinTone = id
  }

  function setFace(id: string) {
    profile.faceShape = id
  }

  function setBody(key: BodyMetricKey, value: number) {
    profile.body[key] = value
  }

  function setPreference(questionId: string, optionId: string) {
    profile.preferences[questionId] = optionId
  }

  function setGender(gender: Gender) {
    profile.gender = gender
  }

  function setHairstyle(hairstyle: HairStyleId) {
    profile.hairstyle = hairstyle
  }

  function persist() {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  }

  function loadPersisted() {
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Partial<UserProfile>
      if (saved.gender === 'female' || saved.gender === 'male') profile.gender = saved.gender
      if (typeof saved.hairstyle === 'string') profile.hairstyle = saved.hairstyle as HairStyleId
      if (Array.isArray(saved.styles)) {
        profile.styles = saved.styles.filter((id: string) =>
          STYLE_OPTIONS.some((o) => o.id === id),
        )
      }
      if (typeof saved.skinTone === 'string' && SKIN_OPTIONS.some((o) => o.id === saved.skinTone)) {
        profile.skinTone = saved.skinTone
      }
      if (typeof saved.faceShape === 'string' && FACE_OPTIONS.some((o) => o.id === saved.faceShape)) {
        profile.faceShape = saved.faceShape
      }
      if (saved.preferences && typeof saved.preferences === 'object') {
        const next: Record<string, string> = {}
        for (const q of PREFERENCE_QUESTIONS) {
          const optId = saved.preferences[q.id]
          if (q.options.some((o) => o.id === optId)) next[q.id] = optId
        }
        profile.preferences = next
      }
      if (saved.body && typeof saved.body === 'object') {
        BODY_FIELDS.forEach((f) => {
          const v = Number(saved.body?.[f.key])
          if (Number.isFinite(v)) profile.body[f.key] = Math.min(f.max, Math.max(f.min, v))
        })
      }
    } catch {
      /* 忽略损坏的本地数据 */
    }
  }

  /* ---------------- 步骤控制 ---------------- */

  function goNext() {
    if (currentStep.value < totalSteps) currentStep.value += 1
  }

  function goPrev() {
    if (currentStep.value > 1) currentStep.value -= 1
  }

  function goto(step: number) {
    if (step >= 1 && step <= totalSteps) currentStep.value = step
  }

  function reset() {
    currentStep.value = 1
    profile.styles = []
    profile.skinTone = ''
    profile.faceShape = ''
    profile.body = defaultBody()
    profile.preferences = {}
  }

  /* ---------------- 校验：当前步是否可以「下一步」 ---------------- */

  const canProceed = computed(() => {
    switch (currentStep.value) {
      case 1:
        return profile.styles.length >= 3 // 至少选 3 个风格
      case 2:
        return profile.skinTone !== ''
      case 3:
        return profile.faceShape !== ''
      case 4:
        return true // 体型有默认值，随时可继续
      case 5:
        return (
          Object.keys(profile.preferences).length === PREFERENCE_QUESTIONS.length
        )
      default:
        return false
    }
  })

  /** 是否已完成全部测试 */
  const isComplete = computed(
    () =>
      profile.styles.length >= 3 &&
      profile.skinTone !== '' &&
      profile.faceShape !== '' &&
      Object.keys(profile.preferences).length === PREFERENCE_QUESTIONS.length,
  )

  const missingCount = computed(() => {
    let missing = 0
    if (profile.styles.length < 3) missing += 1
    if (profile.skinTone === '') missing += 1
    if (profile.faceShape === '') missing += 1
    if (Object.keys(profile.preferences).length < PREFERENCE_QUESTIONS.length) missing += 1
    return missing
  })

  /* ---------------- 结果页要用的派生数据 ---------------- */

  /** BMI（保留 1 位小数） */
  const bmi = computed(() => {
    const h = profile.body.height / 100
    if (!h) return 0
    return Math.round((profile.body.weight / (h * h)) * 10) / 10
  })

  /** 雷达图 5 个维度（0~100，示意算法） */
  const radar = computed<RadarDimension[]>(() => {
    // 风格：选得越多样越高
    const styleScore = Math.round(40 + (profile.styles.length / STYLE_OPTIONS.length) * 60)

    // 肤色：按明度从亮到深递减
    const skinIndex = SKIN_OPTIONS.findIndex((o) => o.id === profile.skinTone)
    const skinScore = skinIndex < 0 ? 60 : 92 - skinIndex * 8

    // 脸型：查表
    const faceScore = FACE_SCORE[profile.faceShape] ?? 70

    // 体型：BMI 越接近 21 越高
    const bodyScore = clamp(Math.round(100 - Math.abs(bmi.value - 21) * 4), 40, 100)

    // 偏好：答题完成度
    const prefScore = Math.round(
      (Object.keys(profile.preferences).length / PREFERENCE_QUESTIONS.length) * 100,
    )

    return [
      { name: '风格', value: styleScore },
      { name: '肤色', value: skinScore },
      { name: '脸型', value: faceScore },
      { name: '体型', value: bodyScore },
      { name: '偏好', value: prefScore },
    ]
  })

  /** 选中的风格标签（结果页展示用） */
  const styleLabels = computed(() =>
    profile.styles
      .map((id) => STYLE_OPTIONS.find((o) => o.id === id)?.label)
      .filter(Boolean) as string[],
  )

  const skinLabel = computed(
    () => SKIN_OPTIONS.find((o) => o.id === profile.skinTone)?.label ?? '',
  )

  const faceLabel = computed(
    () => FACE_OPTIONS.find((o) => o.id === profile.faceShape)?.label ?? '',
  )

  /** 一句话风格总结（示意） */
  const summary = computed(() => {
    if (!isComplete.value) return ''
    const main = styleLabels.value[0] ?? '百搭'
    return `${skinLabel.value} · ${faceLabel.value} · 偏爱「${main}」的你`
  })

  return {
    // state
    currentStep,
    profile,
    totalSteps,
    // actions
    toggleStyle,
    setSkin,
    setFace,
    setBody,
    setPreference,
    setGender,
    setHairstyle,
    persist,
    loadPersisted,
    goNext,
    goPrev,
    goto,
    reset,
    // getters
    canProceed,
    isComplete,
    missingCount,
    bmi,
    radar,
    styleLabels,
    skinLabel,
    faceLabel,
    summary,
  }
})

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}
