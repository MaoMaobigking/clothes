<script setup lang="ts">
/*
 * 演示实名认证。
 *
 * ── 这一页做什么、不做什么 ──
 * 做：姓名 / 手机号 / 身份证号的**格式与校验位**校验（GB 11643，见 utils/idCard.ts），
 *     通过之后在本地记一条脱敏档案，「我的」页显示已认证 + VIP 标记。
 * 不做：真实身份核验。三要素比对要走公安部或运营商接口，需要企业资质和付费通道，
 *     demo 拿不到，也不该假装拿得到。
 *
 * 所以界面上必须写明「演示功能，不做真实核验」—— 技术上的道理是：
 * 符合校验位规则的号码可以按规则批量生成，强校验只能证明「这串数字编得对」，
 * 证明不了「这个人存在」，更证明不了「这个人是你」。
 *
 * ── 明文不落存储 ──
 * 存的是 maskIdCard / maskPhone 之后的串（110101********1234）。
 * 这是个演示表单，没有任何业务需要回读完整号码；存明文只会凭空多一个泄露面。
 * 出生日期和性别是从号码里解析出来的派生信息，留着给「我的」页展示用。
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { maskIdCard, maskPhone, validateIdCard, validatePhone, validateRealName } from '@/utils/idCard'

const VERIFY_KEY = 'ai-fashion-verify'

interface VerifyRecord {
  name: string
  /** 脱敏后的手机号 */
  phone: string
  /** 脱敏后的身份证号 */
  idCard: string
  birthday: string
  gender: string
  verifiedAt: string
  /** 恒为 true：提醒任何读这条记录的人，它不是真实核验结果 */
  demo: true
}

const formRef = ref<any>(null)
const form = ref({ name: '', phone: '', idCard: '' })
const submitting = ref(false)
const record = ref<VerifyRecord | null>(null)

/*
 * uv-form 内部 vendor 了 async-validator（uv-form/valid.js），
 * 这里的 validator 走它的标准契约：出错 callback(new Error(msg))，通过 callback()。
 * 校验逻辑本身放在 utils/idCard.ts —— 结算页那边也要用同一套手机号规则。
 */
const rules = {
  name: [
    { required: true, message: '请输入真实姓名', trigger: ['blur', 'change'] },
    {
      trigger: ['blur'],
      validator: (_rule: any, value: string, callback: (err?: Error) => void) => {
        if (!value || validateRealName(value)) return callback()
        callback(new Error('姓名需为 2–16 个汉字，少数民族名字用「·」分隔'))
      },
    },
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: ['blur', 'change'] },
    {
      trigger: ['blur'],
      validator: (_rule: any, value: string, callback: (err?: Error) => void) => {
        if (!value || validatePhone(value)) return callback()
        callback(new Error('手机号格式不对，应为 11 位且以 1 开头'))
      },
    },
  ],
  idCard: [
    { required: true, message: '请输入身份证号', trigger: ['blur', 'change'] },
    {
      trigger: ['blur'],
      validator: (_rule: any, value: string, callback: (err?: Error) => void) => {
        if (!value) return callback()
        const result = validateIdCard(value)
        // 校验位算错时 message 会直接告诉用户「最后一位应该是 X」，比「格式错误」有用得多
        if (result.ok) return callback()
        callback(new Error(result.message))
      },
    },
  ],
}

function load() {
  try {
    const cached = uni.getStorageSync(VERIFY_KEY)
    record.value = cached ? (JSON.parse(cached) as VerifyRecord) : null
  } catch {
    record.value = null
  }
}

onLoad(load)

const statusText = computed(() => (record.value ? '已完成演示认证' : '未认证'))

async function submit() {
  if (submitting.value) return
  submitting.value = true
  try {
    // uv-form 负责把错误提示挂到对应的 form-item 下面
    await formRef.value?.validate()
    // 再解析一次不是重复校验：这一步是为了取出出生日期和性别，用来展示
    const parsed = validateIdCard(form.value.idCard)
    if (!parsed.ok) throw new Error(parsed.message)

    const saved: VerifyRecord = {
      name: form.value.name.trim(),
      phone: maskPhone(form.value.phone),
      idCard: maskIdCard(form.value.idCard),
      birthday: parsed.birthday || '',
      gender: parsed.gender || '',
      verifiedAt: new Date().toISOString().slice(0, 10),
      demo: true,
    }
    uni.setStorageSync(VERIFY_KEY, JSON.stringify(saved))
    record.value = saved
    form.value = { name: '', phone: '', idCard: '' }
    uni.showToast({ title: '演示认证已完成', icon: 'success' })
  } catch (error) {
    // validate() 是 reject(errors数组)，错误已经显示在字段下方，这里不再弹一次
    if (error instanceof Error) {
      uni.showToast({ title: error.message, icon: 'none' })
    }
  } finally {
    submitting.value = false
  }
}

function revoke() {
  uni.showModal({
    title: '撤销演示认证',
    content: '本地的演示认证记录会被删除，可以重新填写。',
    success: (res) => {
      if (!res.confirm) return
      uni.removeStorageSync(VERIFY_KEY)
      record.value = null
      uni.showToast({ title: '已撤销', icon: 'none' })
    },
  })
}
</script>

<template>
  <view class="page">
    <PageHeader title="实名认证" to="/pages/me/me" />

    <scroll-view scroll-y class="body hide-scrollbar">
      <!-- 这块说明是这一页的主角，不是免责声明的小字：见文件头注释 -->
      <view class="notice">
        <UiIcon name="lock" :size="40" tone="purple" :stroke-width="1.6" />
        <view class="notice-text">
          <text class="notice-title">演示功能，不做真实核验</text>
          <text class="notice-desc">
            这里只校验号码本身编得对不对（GB 11643 校验位）。符合规则的号码可以按规则批量生成，
            所以校验通过不代表号码真实存在，也不代表它属于你。真实核验需要公安部三要素比对接口。
          </text>
        </view>
      </view>

      <template v-if="record">
        <view class="card">
          <view class="card-head">
            <text class="card-title">{{ statusText }}</text>
            <text class="vip-tag">VIP 演示</text>
          </view>
          <view class="row">
            <text class="k">姓名</text>
            <text class="v">{{ record.name }}</text>
          </view>
          <view class="row">
            <text class="k">手机号</text>
            <text class="v">{{ record.phone }}</text>
          </view>
          <view class="row">
            <text class="k">身份证号</text>
            <text class="v">{{ record.idCard }}</text>
          </view>
          <view class="row">
            <text class="k">出生日期</text>
            <text class="v">{{ record.birthday }}</text>
          </view>
          <view class="row">
            <text class="k">性别</text>
            <text class="v">{{ record.gender }}</text>
          </view>
          <view class="row">
            <text class="k">认证时间</text>
            <text class="v">{{ record.verifiedAt }}</text>
          </view>
          <text class="card-foot">号码已脱敏保存，App 内不留明文</text>
        </view>
        <view class="btn btn-ghost wide" @tap="revoke">撤销并重新填写</view>
      </template>

      <template v-else>
        <view class="card">
          <uv-form ref="formRef" :model="form" :rules="rules" label-width="160rpx" error-type="message">
            <uv-form-item label="真实姓名" prop="name" border-bottom>
              <uv-input v-model="form.name" border="none" placeholder="与证件一致" maxlength="16" />
            </uv-form-item>
            <uv-form-item label="手机号" prop="phone" border-bottom>
              <uv-input v-model="form.phone" border="none" type="number" placeholder="11 位手机号" maxlength="11" />
            </uv-form-item>
            <uv-form-item label="身份证号" prop="idCard">
              <uv-input v-model="form.idCard" border="none" placeholder="18 位，最后一位可为 X" maxlength="18" />
            </uv-form-item>
          </uv-form>
        </view>

        <view class="btn btn-primary wide" :class="{ disabled: submitting }" @tap="submit">
          {{ submitting ? '校验中…' : '提交演示认证' }}
        </view>
        <text class="foot">提交后仅在本机保存脱敏记录，不会上传</text>
      </template>
    </scroll-view>
  </view>
</template>

<style scoped>
.body {
  flex: 1;
  min-height: 0;
  padding: 12rpx 32rpx 48rpx;
}
.notice {
  margin-top: 18rpx;
  padding: 24rpx;
  display: flex;
  gap: 16rpx;
  border-radius: var(--radius);
  background: var(--surface-soft);
  box-shadow: var(--shadow-card);
}
.notice-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.notice-title {
  font-size: 27rpx;
  font-weight: 700;
  color: var(--text-1);
}
.notice-desc {
  font-size: 22rpx;
  line-height: 1.6;
  color: var(--text-3);
}
.card {
  margin-top: 22rpx;
  padding: 24rpx;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-1);
}
.vip-tag {
  padding: 4rpx 18rpx;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 16rpx 0;
  border-bottom: 1px solid var(--line);
}
.row:last-of-type {
  border-bottom: none;
}
.k {
  font-size: 24rpx;
  color: var(--text-3);
}
.v {
  font-size: 25rpx;
  color: var(--text-1);
  font-weight: 500;
}
.card-foot {
  display: block;
  margin-top: 12rpx;
  font-size: 21rpx;
  color: var(--text-3);
}
.wide {
  width: 100%;
  margin-top: 26rpx;
}
.wide.disabled {
  opacity: 0.6;
}
.foot {
  display: block;
  margin-top: 16rpx;
  text-align: center;
  font-size: 21rpx;
  color: var(--text-3);
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
