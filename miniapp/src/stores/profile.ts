import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  BODY_FIELDS,
  FACE_OPTIONS,
  PREFERENCE_QUESTIONS,
  SKIN_OPTIONS,
  STEPS,
  STYLE_OPTIONS,
  VISUAL_BODY_OPTIONS,
} from '@/data/questions'
import type {
  AvatarShape,
  BodyMetricKey,
  Gender,
  HairStyleId,
  RadarDimension,
  UserProfile,
  VisualBodyId,
} from '@/types'

const PROFILE_STORAGE_KEY = 'ai-fashion-profile'

function defaultBody(): Record<BodyMetricKey, number> {
  return BODY_FIELDS.reduce(
    (acc, f) => {
      acc[f.key] = f.default
      return acc
    },
    {} as Record<BodyMetricKey, number>,
  )
}

function defaultProgress() {
  return {
    genderSelected: false,
    visualBodySelected: false,
    heightTouched: false,
    weightTouched: false,
  }
}

const FACE_SCORE: Record<string, number> = {
  oval: 95, heart: 88, diamond: 84, square: 80, round: 78, long: 76,
}

export const useProfileStore = defineStore('profile', () => {
  const currentStep = ref(1)
  const profile = reactive<UserProfile>({
    styles: [],
    skinTone: '',
    faceShape: '',
    body: defaultBody(),
    visualBody: '',
    preferences: {},
    gender: '',
    hairstyle: 'straight',
    progress: defaultProgress(),
  })
  const totalSteps = STEPS.length

  function toggleStyle(id: string) {
    const i = profile.styles.indexOf(id)
    if (i >= 0) profile.styles.splice(i, 1)
    else if (profile.styles.length < 3) profile.styles.push(id)
  }
  function setSkin(id: string) { profile.skinTone = id }
  function setFace(id: string) { profile.faceShape = id }
  function setBody(key: BodyMetricKey, value: number) {
    profile.body[key] = value
    if (key === 'height') profile.progress.heightTouched = true
    if (key === 'weight') profile.progress.weightTouched = true
  }
  function setVisualBody(id: VisualBodyId) {
    profile.visualBody = id
    profile.progress.visualBodySelected = true
  }
  function setPreference(questionId: string, optionId: string) { profile.preferences[questionId] = optionId }
  function setGender(gender: Gender) {
    profile.gender = gender
    profile.progress.genderSelected = true
  }
  function setHairstyle(hairstyle: HairStyleId) { profile.hairstyle = hairstyle }

  function persist() {
    uni.setStorageSync(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  }

  function applyRemoteProfile(remote: any) {
    if (!remote || typeof remote !== 'object') return
    if (Array.isArray(remote.styles)) {
      profile.styles = remote.styles
        .filter((id: string) => STYLE_OPTIONS.some((option) => option.id === id))
        .slice(0, 3)
    }
    if (remote.gender === 'female' || remote.gender === 'male') {
      profile.gender = remote.gender
      profile.progress.genderSelected = true
    }
    if (typeof remote.skin === 'string') profile.skinTone = remote.skin
    if (typeof remote.face === 'string') profile.faceShape = remote.face
    if (typeof remote.visualBody === 'string' &&
        VISUAL_BODY_OPTIONS.some((option) => option.id === remote.visualBody)) {
      profile.visualBody = remote.visualBody
      profile.progress.visualBodySelected = true
    }

    const numeric = [
      ['height', 'height'],
      ['weight', 'weight'],
      ['bust', 'bust'],
      ['waist', 'waist'],
      ['hip', 'hips'],
      ['shoulder', 'shoulder'],
      ['thigh', 'thigh'],
      ['calf', 'calf'],
    ] as const
    numeric.forEach(([profileKey, remoteKey]) => {
      const value = Number(remote[remoteKey])
      if (Number.isFinite(value)) profile.body[profileKey] = value
    })
    if (Number.isFinite(Number(remote.height))) profile.progress.heightTouched = true
    if (Number.isFinite(Number(remote.weight))) profile.progress.weightTouched = true

    if (remote.preferences && typeof remote.preferences === 'object') {
      const next: Record<string, string> = {}
      for (const question of PREFERENCE_QUESTIONS) {
        const optionId = remote.preferences[question.id]
        if (question.options.some((option) => option.id === optionId)) next[question.id] = optionId
      }
      profile.preferences = next
    }
    persist()
  }

  function loadPersisted() {
    try {
      const raw = uni.getStorageSync(PROFILE_STORAGE_KEY)
      if (!raw) return
      const saved = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (saved.gender === 'female' || saved.gender === 'male') {
        profile.gender = saved.gender
        profile.progress.genderSelected = true
      }
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
      if (typeof saved.visualBody === 'string' &&
          VISUAL_BODY_OPTIONS.some((o) => o.id === saved.visualBody)) {
        profile.visualBody = saved.visualBody as VisualBodyId
        profile.progress.visualBodySelected = true
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
        profile.progress.heightTouched = true
        profile.progress.weightTouched = true
        BODY_FIELDS.forEach((f) => {
          const v = Number(saved.body[f.key])
          if (Number.isFinite(v)) profile.body[f.key] = Math.min(f.max, Math.max(f.min, v))
        })
      }
      if (saved.progress && typeof saved.progress === 'object') {
        profile.progress.genderSelected = profile.progress.genderSelected || Boolean(saved.progress.genderSelected)
        profile.progress.visualBodySelected = profile.progress.visualBodySelected || Boolean(saved.progress.visualBodySelected)
        profile.progress.heightTouched = profile.progress.heightTouched || Boolean(saved.progress.heightTouched)
        profile.progress.weightTouched = profile.progress.weightTouched || Boolean(saved.progress.weightTouched)
      }
    } catch {
      /* 忽略损坏的本地数据 */
    }
  }

  function goNext() { if (currentStep.value < totalSteps) currentStep.value += 1 }
  function goPrev() { if (currentStep.value > 1) currentStep.value -= 1 }
  function goto(step: number) { if (step >= 1 && step <= totalSteps) currentStep.value = step }
  function reset() {
    currentStep.value = 1
    profile.styles = []
    profile.skinTone = ''
    profile.faceShape = ''
    profile.body = defaultBody()
    profile.visualBody = ''
    profile.preferences = {}
    profile.gender = ''
    profile.progress = defaultProgress()
  }

  const canProceed = computed(() => {
    switch (currentStep.value) {
      case 1: return profile.styles.length === 3
      case 2: return profile.skinTone !== ''
      case 3: return profile.faceShape !== ''
      case 4: return bodyReady.value
      case 5: return answeredPreferences.value >= 3
      default: return false
    }
  })

  const answeredPreferences = computed(() => Object.keys(profile.preferences).length)
  const bodyReady = computed(() =>
    profile.progress.genderSelected &&
    profile.progress.visualBodySelected &&
    profile.progress.heightTouched &&
    profile.progress.weightTouched,
  )

  const isComplete = computed(() =>
    profile.styles.length === 3 &&
    bodyReady.value &&
    answeredPreferences.value >= 3,
  )

  const missingCount = computed(() => {
    let missing = 0
    if (profile.styles.length < 3) missing += 1
    if (!bodyReady.value) missing += 1
    if (answeredPreferences.value < 3) missing += 1
    return missing
  })

  const incompleteDimensions = computed<RadarDimension[]>(() => {
    const list: RadarDimension[] = []
    if (!profile.skinTone) list.push({ name: '肤色', value: 0, incomplete: true })
    if (!profile.faceShape) list.push({ name: '脸型', value: 0, incomplete: true })
    if (answeredPreferences.value < PREFERENCE_QUESTIONS.length) {
      list.push({
        name: '偏好',
        value: answeredPreferences.value,
        incomplete: true,
      })
    }
    return list
  })

  const bmi = computed(() => {
    const h = profile.body.height / 100
    if (!h) return 0
    return Math.round((profile.body.weight / (h * h)) * 10) / 10
  })

  const radar = computed<RadarDimension[]>(() => {
    const styleScore = Math.round(40 + (profile.styles.length / 3) * 60)
    const skinIndex = SKIN_OPTIONS.findIndex((o) => o.id === profile.skinTone)
    const skinScore = skinIndex < 0 ? 0 : 92 - skinIndex * 8
    const faceScore = FACE_SCORE[profile.faceShape] ?? 0
    const bodyScore = clamp(Math.round(100 - Math.abs(bmi.value - 21) * 4), 40, 100)
    const prefScore = Math.round((answeredPreferences.value / PREFERENCE_QUESTIONS.length) * 100)
    return [
      { name: '风格', value: styleScore },
      { name: '肤色', value: skinScore, incomplete: !profile.skinTone },
      { name: '脸型', value: faceScore, incomplete: !profile.faceShape },
      { name: '体型', value: bodyScore },
      { name: '偏好', value: prefScore, incomplete: answeredPreferences.value < PREFERENCE_QUESTIONS.length },
    ]
  })

  const styleLabels = computed(() =>
    profile.styles.map((id) => STYLE_OPTIONS.find((o) => o.id === id)?.label).filter(Boolean) as string[],
  )
  const skinLabel = computed(() => SKIN_OPTIONS.find((o) => o.id === profile.skinTone)?.label ?? '')
  const faceLabel = computed(() => FACE_OPTIONS.find((o) => o.id === profile.faceShape)?.label ?? '')
  const visualBodyLabel = computed(() =>
    VISUAL_BODY_OPTIONS.find((o) => o.id === profile.visualBody)?.label ?? '',
  )

  /** 喂给 AvatarViewer 的身形参数（规格 §7.9）；围度只在用户改过默认值时才传 */
  const avatarShape = computed<AvatarShape>(() => {
    const girth = (key: 'shoulder' | 'waist' | 'hip') => {
      const value = profile.body[key]
      const fallback = BODY_FIELDS.find((f) => f.key === key)?.default
      return value && value !== fallback ? value : undefined
    }
    return {
      gender: profile.gender,
      height: profile.progress.heightTouched ? profile.body.height : 0,
      weight: profile.progress.weightTouched ? profile.body.weight : 0,
      visualBody: profile.visualBody,
      shoulder: girth('shoulder'),
      waist: girth('waist'),
      hip: girth('hip'),
    }
  })
  const summary = computed(() => {
    if (!isComplete.value) return ''
    const main = styleLabels.value[0] ?? '百搭'
    return [skinLabel.value, faceLabel.value, `偏爱「${main}」的你`]
      .filter(Boolean)
      .join(' · ')
  })

  return {
    currentStep, profile, totalSteps,
    toggleStyle, setSkin, setFace, setBody, setVisualBody, setPreference, setGender, setHairstyle,
    persist, loadPersisted,
    applyRemoteProfile,
    goNext, goPrev, goto, reset,
    canProceed, isComplete, answeredPreferences, bodyReady, missingCount,
    incompleteDimensions, bmi, radar, styleLabels, skinLabel, faceLabel, visualBodyLabel, summary,
    avatarShape,
  }
})

function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)) }
