<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import { CUSTOM_STEPS, getCustomCategory, type CustomCategory } from '@/data/custom'
import {
  fetchCustomSummary,
  submitCustomInquiry,
  submitCustomMeasurement,
  upgradeCustomMembership,
  uploadCustomImages,
  type CustomSummary,
} from '@/api/custom'

const category = ref<CustomCategory>(getCustomCategory())
const summary = ref<CustomSummary | null>(null)
const showInquiry = ref(false)
const showMeasure = ref(false)
const showVipUpgrade = ref(false)
const submitting = ref(false)
const upgrading = ref(false)
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

const inquiry = reactive({
  requirements: '',
  budget: '',
  sizeNotes: '',
  referenceImages: [] as string[],
})

const measurement = reactive({
  height: '',
  weight: '',
  bust: '',
  waist: '',
  hips: '',
  shoulder: '',
  notes: '',
  frontImage: '',
  sideImage: '',
  backImage: '',
  detailImages: [] as string[],
})

const vipCases = computed(() => category.value.cases.filter((item) => item.vipOnly))
const isVip = computed(() => summary.value?.membershipLevel === 'vip')

onLoad(async (options) => {
  category.value = getCustomCategory(options?.key)
  try {
    summary.value = await fetchCustomSummary()
  } catch {
    summary.value = null
  }
})

function showToast(message: string) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 1900)
}

function chooseImages(target: string[], limit: number) {
  const remaining = Math.max(0, limit - target.length)
  if (!remaining) return
  uni.chooseImage({
    count: remaining,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      target.push(...res.tempFilePaths.slice(0, remaining))
    },
  })
}

function chooseSingle(field: 'frontImage' | 'sideImage' | 'backImage') {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const path = res.tempFilePaths[0]
      if (path) measurement[field] = path
    },
  })
}

function removeImage(target: string[], index: number) {
  target.splice(index, 1)
}

function previewImage(path: string) {
  if (!path) return
  uni.previewImage({ current: path, urls: [path] })
}

async function submitInquiry() {
  if (!inquiry.requirements.trim()) {
    showToast('请先填写需求描述')
    return
  }
  if (submitting.value) return
  submitting.value = true
  try {
    const referenceImages = await uploadCustomImages(inquiry.referenceImages)
    const request = await submitCustomInquiry({
      serviceType: category.value.key,
      requirements: inquiry.requirements.trim(),
      budget: inquiry.budget.trim(),
      sizeNotes: inquiry.sizeNotes.trim(),
      referenceImages,
    })
    showInquiry.value = false
    showToast('已提交，设计师将尽快联系')
    uni.navigateTo({ url: `/pages/custom/order?id=${request.id}` })
  } catch (err) {
    showToast(err instanceof Error ? err.message : '提交失败')
  } finally {
    submitting.value = false
  }
}

function requiredNumber(value: string, label: string, min: number, max: number) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max) {
    showToast(`${label}需在 ${min}-${max} 之间`)
    return null
  }
  return number
}

async function submitMeasurement(vipOnly = false) {
  const fields = [
    [measurement.height, '身高', 100, 250],
    [measurement.weight, '体重', 25, 250],
    [measurement.bust, '胸围', 50, 180],
    [measurement.waist, '腰围', 40, 180],
    [measurement.hips, '臀围', 50, 200],
    [measurement.shoulder, '肩宽', 20, 100],
  ] as const
  const values: number[] = []
  for (const [value, label, min, max] of fields) {
    const number = requiredNumber(String(value), label, min, max)
    if (number === null) return
    values.push(number)
  }
  if (!measurement.frontImage || !measurement.sideImage) {
    showToast('请上传正面和侧面全身照')
    return
  }
  if (submitting.value) return

  submitting.value = true
  try {
    const paths = [
      measurement.frontImage,
      measurement.sideImage,
      measurement.backImage,
      ...measurement.detailImages,
    ].filter(Boolean)
    const urls = await uploadCustomImages(paths)
    const request = await submitCustomMeasurement({
      serviceType: category.value.key,
      height: values[0],
      weight: values[1],
      bust: values[2],
      waist: values[3],
      hips: values[4],
      shoulder: values[5],
      frontImage: urls[0],
      sideImage: urls[1],
      backImage: urls[2] || '',
      detailImages: urls.slice(3),
      notes: measurement.notes.trim(),
      vipOnly,
    })
    showMeasure.value = false
    showToast('量体预约已提交')
    uni.navigateTo({ url: `/pages/custom/order?id=${request.id}` })
  } catch (err) {
    showToast(err instanceof Error ? err.message : '提交失败')
  } finally {
    submitting.value = false
  }
}

function requestVip() {
  if (isVip.value) {
    openVipMeasure()
    return
  }
  showVipUpgrade.value = true
}

const submitVipAfterOpen = ref(false)

function openStandardMeasure() {
  submitVipAfterOpen.value = false
  showMeasure.value = true
}

function openVipMeasure() {
  submitVipAfterOpen.value = true
  showMeasure.value = true
}

function closeMeasure() {
  showMeasure.value = false
  submitVipAfterOpen.value = false
}

function submitVipMeasurement() {
  submitMeasurement(true)
}

async function upgradeVip() {
  if (upgrading.value) return
  upgrading.value = true
  try {
    summary.value = await upgradeCustomMembership()
    showVipUpgrade.value = false
    showToast('已切换为演示 VIP 身份')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '升级失败')
  } finally {
    upgrading.value = false
  }
}
</script>

<template>
  <view class="page">
    <PageHeader :title="category.label" to="/pages/custom/index" sub="差异化定制服务" />

    <scroll-view scroll-y class="body hide-scrollbar">
      <view class="hero">
        <view class="hero-image">
          <image :src="category.image" mode="aspectFit" />
        </view>
        <view class="hero-copy">
          <text class="hero-emoji">{{ category.emoji }}</text>
          <text class="hero-title">{{ category.label }}</text>
          <text class="hero-desc">{{ category.desc }}</text>
        </view>
      </view>

      <view class="process">
        <view
          v-for="(step, index) in CUSTOM_STEPS"
          :key="step"
          class="process-step"
        >
          <text class="process-index">{{ index + 1 }}</text>
          <text class="process-label">{{ step }}</text>
        </view>
      </view>

      <view>
        <view class="section-title">真实案例</view>
        <view class="cases">
          <view v-for="item in category.cases" :key="item.title" class="case">
            <view class="case-image">
              <image :src="item.image" mode="aspectFill" />
            </view>
            <view class="case-copy">
              <view class="case-title-row">
                <text class="case-title">{{ item.title }}</text>
                <text v-if="item.vipOnly" class="vip-tag">VIP</text>
              </view>
              <text class="case-desc">{{ item.desc }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="actions">
        <button class="btn btn-primary action" @tap="showInquiry = true">立即咨询</button>
        <button class="btn btn-ghost action" @tap="openStandardMeasure">预约量体裁衣</button>
      </view>

      <view v-if="vipCases.length" class="premium">
        <view class="premium-head">
          <view>
            <text class="premium-title">高端定制案例</text>
            <text class="premium-desc">明星同款、手工工艺与限量联名</text>
          </view>
          <text class="vip-badge">{{ isVip ? '已开通' : 'VIP 专属' }}</text>
        </view>
        <view class="premium-cases">
          <text v-for="item in vipCases" :key="item.title" class="premium-case">
            {{ item.title }}
          </text>
        </view>
        <button class="btn btn-primary premium-btn" @tap="requestVip">
          {{ isVip ? '预约 VIP 专属服务' : '查看 VIP 预约方式' }}
        </button>
      </view>
    </scroll-view>

    <view v-if="showInquiry" class="mask" @tap="showInquiry = false">
      <view class="sheet" @tap.stop>
        <view class="sheet-head">
          <text class="sheet-title">立即咨询</text>
          <text class="sheet-close" @tap="showInquiry = false">关闭</text>
        </view>
        <scroll-view scroll-y class="sheet-body">
          <textarea
            v-model="inquiry.requirements"
            class="textarea"
            placeholder="描述风格、用途和特殊要求"
            maxlength="1000"
          />
          <view class="field-row">
            <input v-model="inquiry.budget" class="input half" placeholder="预算区间（可选）" />
            <input v-model="inquiry.sizeNotes" class="input half" placeholder="尺码说明（可选）" />
          </view>
          <text class="field-label">参考图（最多 3 张）</text>
          <view class="image-picker">
            <view v-for="(path, index) in inquiry.referenceImages" :key="path" class="picked">
              <image :src="path" class="picked-image" mode="aspectFill" @tap="previewImage(path)" />
              <text class="remove" @tap.stop="removeImage(inquiry.referenceImages, index)">×</text>
            </view>
            <view
              v-if="inquiry.referenceImages.length < 3"
              class="picker"
              @tap="chooseImages(inquiry.referenceImages, 3)"
            >
              <text class="picker-plus">+</text>
              <text class="picker-label">添加图片</text>
            </view>
          </view>
        </scroll-view>
        <button class="btn btn-primary sheet-submit" :disabled="submitting" @tap="submitInquiry">
          {{ submitting ? '提交中…' : '提交咨询' }}
        </button>
      </view>
    </view>

    <view v-if="showMeasure" class="mask" @tap="closeMeasure">
      <view class="sheet tall-sheet" @tap.stop>
        <view class="sheet-head">
          <text class="sheet-title">预约量体裁衣</text>
          <text class="sheet-close" @tap="closeMeasure">关闭</text>
        </view>
        <scroll-view scroll-y class="sheet-body">
          <text class="field-label">六项必填尺寸（cm / kg）</text>
          <view class="measure-grid">
            <label class="measure-field">
              <text>身高</text>
              <input v-model="measurement.height" type="digit" placeholder="160" />
            </label>
            <label class="measure-field">
              <text>体重</text>
              <input v-model="measurement.weight" type="digit" placeholder="55" />
            </label>
            <label class="measure-field">
              <text>胸围</text>
              <input v-model="measurement.bust" type="digit" placeholder="88" />
            </label>
            <label class="measure-field">
              <text>腰围</text>
              <input v-model="measurement.waist" type="digit" placeholder="68" />
            </label>
            <label class="measure-field">
              <text>臀围</text>
              <input v-model="measurement.hips" type="digit" placeholder="92" />
            </label>
            <label class="measure-field">
              <text>肩宽</text>
              <input v-model="measurement.shoulder" type="digit" placeholder="39" />
            </label>
          </view>

          <text class="field-label required">正面全身照</text>
          <view v-if="measurement.frontImage" class="required-image">
            <image :src="measurement.frontImage" mode="aspectFill" @tap="previewImage(measurement.frontImage)" />
            <text class="remove" @tap.stop="measurement.frontImage = ''">×</text>
          </view>
          <view v-else class="required-image picker-box" @tap="chooseSingle('frontImage')">
            <text class="picker-plus">+</text>
            <text class="picker-label">正面照</text>
          </view>

          <text class="field-label required">侧面全身照</text>
          <view v-if="measurement.sideImage" class="required-image">
            <image :src="measurement.sideImage" mode="aspectFill" @tap="previewImage(measurement.sideImage)" />
            <text class="remove" @tap.stop="measurement.sideImage = ''">×</text>
          </view>
          <view v-else class="required-image picker-box" @tap="chooseSingle('sideImage')">
            <text class="picker-plus">+</text>
            <text class="picker-label">侧面照</text>
          </view>

          <text class="field-label">后视图（可选）</text>
          <view v-if="measurement.backImage" class="optional-image">
            <image :src="measurement.backImage" mode="aspectFill" @tap="previewImage(measurement.backImage)" />
            <text class="remove" @tap.stop="measurement.backImage = ''">×</text>
          </view>
          <view v-else class="optional-image picker-box" @tap="chooseSingle('backImage')">
            <text class="picker-plus">+</text>
          </view>

          <text class="field-label">细节图（最多 3 张）</text>
          <view class="image-picker">
            <view v-for="(path, index) in measurement.detailImages" :key="path" class="picked">
              <image :src="path" class="picked-image" mode="aspectFill" @tap="previewImage(path)" />
              <text class="remove" @tap.stop="removeImage(measurement.detailImages, index)">×</text>
            </view>
            <view
              v-if="measurement.detailImages.length < 3"
              class="picker"
              @tap="chooseImages(measurement.detailImages, 3)"
            >
              <text class="picker-plus">+</text>
            </view>
          </view>

          <textarea
            v-model="measurement.notes"
            class="textarea notes"
            placeholder="特殊体态或穿着说明（可选）"
            maxlength="512"
          />
        </scroll-view>
        <button
          class="btn btn-primary sheet-submit"
          :disabled="submitting"
          @tap="submitVipAfterOpen ? submitVipMeasurement() : submitMeasurement(false)"
        >
          {{ submitting ? '提交中…' : submitVipAfterOpen ? '提交 VIP 量体预约' : '提交量体预约' }}
        </button>
      </view>
    </view>

    <view v-if="showVipUpgrade" class="mask" @tap="showVipUpgrade = false">
      <view class="vip-sheet" @tap.stop>
        <text class="vip-sheet-title">VIP 专属预约</text>
        <text class="vip-sheet-desc">
          高端定制案例需要演示会员等级。当前会切换当前开发账号为 VIP，不会进行真实付费或实名认证。
        </text>
        <button class="btn btn-primary" :disabled="upgrading" @tap="upgradeVip">
          {{ upgrading ? '切换中…' : '演示升级 VIP' }}
        </button>
        <button class="btn btn-ghost" @tap="showVipUpgrade = false">暂不升级</button>
      </view>
    </view>

    <view v-if="toast" class="toast">{{ toast }}</view>
  </view>
</template>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.body {
  flex: 1;
  min-height: 0;
  padding: 12rpx 32rpx calc(40rpx + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}
.hero {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 22rpx;
  border-radius: var(--radius-lg);
  background: linear-gradient(150deg, rgba(255, 231, 243, 0.96), rgba(234, 231, 255, 0.96));
  box-shadow: var(--shadow-card);
}
.hero-image {
  width: 220rpx;
  height: 250rpx;
  flex-shrink: 0;
  border-radius: 26rpx;
  overflow: hidden;
  background: linear-gradient(150deg, #ffe6f2, #e7dcff);
}
.hero-image image {
  width: 100%;
  height: 100%;
}
.hero-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.hero-emoji {
  font-size: 46rpx;
}
.hero-title {
  font-size: 36rpx;
  font-weight: 900;
  color: var(--text-1);
}
.hero-desc {
  font-size: 24rpx;
  line-height: 1.5;
  color: var(--text-2);
}

.process {
  display: flex;
  gap: 12rpx;
}
.process-step {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
}
.process-index {
  width: 50rpx;
  height: 50rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--brand-gradient);
  color: #fff;
  font-size: 23rpx;
  font-weight: 800;
}
.process-label {
  font-size: 20rpx;
  color: var(--text-2);
  text-align: center;
  line-height: 1.25;
}

.section-title {
  margin-bottom: 20rpx;
  font-size: 31rpx;
  font-weight: 800;
  color: var(--text-1);
}
.cases {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}
.case {
  display: flex;
  gap: 20rpx;
  padding: 18rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}
.case-image {
  width: 190rpx;
  height: 155rpx;
  flex-shrink: 0;
  border-radius: 24rpx;
  overflow: hidden;
  background: linear-gradient(150deg, #ffe6f2, #d7ecff);
}
.case-image image {
  width: 100%;
  height: 100%;
}
.case-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10rpx;
}
.case-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.case-title {
  font-size: 27rpx;
  font-weight: 800;
  color: var(--text-1);
}
.vip-tag,
.vip-badge {
  flex-shrink: 0;
  padding: 5rpx 13rpx;
  border-radius: var(--radius-pill);
  background: rgba(177, 140, 255, 0.16);
  color: var(--purple-deep);
  font-size: 19rpx;
  font-weight: 800;
}
.case-desc {
  font-size: 23rpx;
  line-height: 1.45;
  color: var(--text-2);
}

.actions {
  display: flex;
  gap: 18rpx;
}
.action {
  flex: 1;
  height: 84rpx;
  font-size: 26rpx;
}
.premium {
  padding: 30rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}
.premium-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}
.premium-title {
  display: block;
  font-size: 29rpx;
  font-weight: 800;
}
.premium-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--text-2);
}
.premium-cases {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 20rpx;
}
.premium-case {
  padding: 11rpx 17rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  border: 2rpx solid var(--line);
  color: var(--text-1);
  font-size: 22rpx;
}
.premium-btn {
  height: 80rpx;
  margin-top: 22rpx;
}

.mask {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: flex-end;
  background: rgba(31, 25, 45, 0.42);
}
.sheet {
  width: 100%;
  max-height: 92vh;
  padding: 34rpx 32rpx calc(32rpx + env(safe-area-inset-bottom, 0px));
  border-radius: 44rpx 44rpx 0 0;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}
.tall-sheet {
  max-height: 96vh;
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}
.sheet-title {
  font-size: 34rpx;
  font-weight: 800;
}
.sheet-close {
  color: var(--text-3);
  font-size: 25rpx;
}
.sheet-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  padding: 4rpx 2rpx;
}
.textarea,
.input {
  width: 100%;
  border: 2rpx solid var(--line);
  border-radius: var(--radius);
  background: #fff;
  padding: 22rpx;
  font-size: 27rpx;
  color: var(--text-1);
  box-sizing: border-box;
}
.textarea {
  min-height: 180rpx;
}
.textarea.notes {
  min-height: 130rpx;
}
.field-row,
.measure-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}
.input.half {
  min-width: 0;
}
.field-label {
  font-size: 24rpx;
  font-weight: 750;
  color: var(--text-1);
}
.field-label.required::after {
  content: ' *';
  color: var(--pink-deep);
}
.measure-field {
  display: flex;
  flex-direction: column;
  gap: 9rpx;
  font-size: 23rpx;
  color: var(--text-2);
}
.measure-field input {
  border: 2rpx solid var(--line);
  border-radius: 24rpx;
  padding: 16rpx 18rpx;
  font-size: 26rpx;
}
.image-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.picked,
.picker,
.required-image,
.optional-image {
  position: relative;
  width: 170rpx;
  height: 170rpx;
  border-radius: 24rpx;
  overflow: hidden;
}
.picked,
.picker {
  display: flex;
  align-items: center;
  justify-content: center;
}
.picker,
.picker-box {
  background: var(--surface-soft);
  border: 2rpx dashed #d8cfea;
  color: var(--purple-deep);
}
.picked-image,
.required-image image,
.optional-image image {
  width: 100%;
  height: 100%;
}
.remove {
  position: absolute;
  top: 5rpx;
  right: 5rpx;
  width: 42rpx;
  height: 42rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(47, 47, 58, 0.78);
  color: #fff;
  font-size: 27rpx;
}
.picker-plus {
  font-size: 46rpx;
  line-height: 1;
}
.picker-label {
  position: absolute;
  bottom: 20rpx;
  font-size: 20rpx;
  color: var(--text-3);
}
.sheet-submit {
  flex-shrink: 0;
  height: 86rpx;
}

.vip-sheet {
  width: 100%;
  padding: 38rpx 32rpx calc(32rpx + env(safe-area-inset-bottom, 0px));
  border-radius: 44rpx 44rpx 0 0;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.vip-sheet-title {
  font-size: 34rpx;
  font-weight: 800;
}
.vip-sheet-desc {
  font-size: 25rpx;
  line-height: 1.55;
  color: var(--text-2);
}
.vip-sheet .btn {
  height: 84rpx;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 120rpx);
  transform: translateX(-50%);
  z-index: 60;
  padding: 18rpx 30rpx;
  border-radius: var(--radius-pill);
  background: rgba(47, 47, 58, 0.88);
  color: #fff;
  font-size: 25rpx;
  white-space: nowrap;
}
</style>
