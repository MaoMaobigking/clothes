<script setup lang="ts">
/*
 * 演示结算页。
 *
 * ── 三件明确不做的事，都在界面上写着 ──
 * 1. 不接支付：微信支付要商户号 + 企业主体 + 签约，demo 拿不到。提交后订单停在「待付款」，
 *    后续状态由订单详情页的演示按钮推进。做个点了就跳「支付成功」的假收银台没有意义。
 * 2. 不用 wx.chooseAddress：那个接口要求小程序过特定服务类目认证，demo 号调用直接 fail。
 * 3. 不做省市区三级联动：标准数据源（modood/Administrative-divisions-of-China）的三级 JSON
 *    有 200–700KB，而主包体积已经超标。这一版地址是「姓名 + 手机 + 单行详细地址」，
 *    等分包方案定了再补 —— 后端 shop_addresses 的 detail 列语义届时不变。
 *
 * 金额一律由后端算：优惠券规则在 server/services/orderService.mjs 的 calcDiscount，
 * 前端只显示。换券就重新拉一次预览，不在前端复刻一份计算逻辑 —— 两处算钱迟早算不一样。
 */
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { createAddress, fetchCheckoutPreview, submitOrder, type CheckoutPreview } from '@/api/order'
import { isAuthError } from '@/utils/request'
import { validatePhone, validateRealName } from '@/utils/idCard'

const preview = ref<CheckoutPreview | null>(null)
const loading = ref(true)
const errorText = ref('')
const submitting = ref(false)

const couponKey = ref('')
const addressId = ref<number | null>(null)
const remark = ref('')

/** 新增地址的抽屉。没有地址时默认展开，省得用户还要先找到「新增」按钮 */
const addingAddress = ref(false)
const addressFormRef = ref<any>(null)
const addressForm = ref({ receiver: '', phone: '', detail: '' })

/*
 * uv-form 内部 vendor 了 async-validator，validator 走它的标准契约。
 * 姓名和手机号的规则和实名页共用 utils/idCard.ts —— 同一个 App 里两套手机号正则
 * 迟早会出现「这里过得了那里过不了」。
 */
const addressRules = {
  receiver: [
    { required: true, message: '请输入收货人姓名', trigger: ['blur', 'change'] },
    {
      trigger: ['blur'],
      validator: (_r: any, value: string, callback: (err?: Error) => void) =>
        !value || validateRealName(value) ? callback() : callback(new Error('姓名需为 2–16 个汉字')),
    },
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: ['blur', 'change'] },
    {
      trigger: ['blur'],
      validator: (_r: any, value: string, callback: (err?: Error) => void) =>
        !value || validatePhone(value) ? callback() : callback(new Error('手机号格式不对，应为 11 位且以 1 开头')),
    },
  ],
  detail: [
    { required: true, message: '请输入详细地址', trigger: ['blur', 'change'] },
    {
      trigger: ['blur'],
      validator: (_r: any, value: string, callback: (err?: Error) => void) =>
        !value || value.trim().length >= 5 ? callback() : callback(new Error('详细地址至少 5 个字，写到门牌号')),
    },
  ],
}

function toast(title: string) {
  uni.showToast({ title, icon: 'none' })
}

async function load(nextCoupon = couponKey.value) {
  try {
    const data = await fetchCheckoutPreview(nextCoupon)
    preview.value = data
    // 后端会把「选了但当前不满门槛」的券降级成不选，这里跟随后端结果，避免两边不一致
    couponKey.value = data.selectedCoupon
    if (addressId.value === null) {
      addressId.value = data.addresses.find((item) => item.isDefault)?.id ?? data.addresses[0]?.id ?? null
    }
    addingAddress.value = data.addresses.length === 0
    errorText.value = ''
  } catch (error) {
    if (!isAuthError(error)) {
      errorText.value = error instanceof Error ? error.message : '结算信息加载失败'
    }
  } finally {
    loading.value = false
  }
}

onShow(() => {
  load()
})

/** 换券要重新问后端算，不在前端复刻优惠规则 */
function pickCoupon(key: string, usable: boolean) {
  if (!usable && key !== '') {
    toast('这张券当前不可用')
    return
  }
  const next = couponKey.value === key ? '' : key
  couponKey.value = next
  load(next)
}

async function saveAddress() {
  try {
    await addressFormRef.value?.validate()
    const created = await createAddress({
      receiver: addressForm.value.receiver.trim(),
      phone: addressForm.value.phone.trim(),
      detail: addressForm.value.detail.trim(),
      isDefault: !preview.value?.addresses.length,
    })
    addressId.value = created.id
    addressForm.value = { receiver: '', phone: '', detail: '' }
    addingAddress.value = false
    await load()
    toast('地址已保存')
  } catch (error) {
    // validate() reject 的是错误数组，提示已经挂在字段下方，这里不再弹一次
    if (error instanceof Error) toast(error.message)
  }
}

async function submit() {
  if (submitting.value) return
  if (!preview.value?.items.length) {
    toast('购物车是空的')
    return
  }
  if (!addressId.value) {
    toast('请先填写收货地址')
    addingAddress.value = true
    return
  }
  submitting.value = true
  try {
    const order = await submitOrder({
      addressId: addressId.value,
      couponKey: couponKey.value,
      remark: remark.value.trim(),
    })
    // redirectTo：订单已经建了，返回键回到结算页只会让人以为要再下一单
    uni.redirectTo({ url: `/pages/order-detail/index?id=${order.id}` })
  } catch (error) {
    if (!isAuthError(error)) {
      toast(error instanceof Error ? error.message : '下单失败')
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page">
    <PageHeader title="确认订单" to="/pages/cart/index" />

    <scroll-view scroll-y class="body hide-scrollbar">
      <view v-if="loading" class="state">加载中…</view>
      <view v-else-if="errorText" class="state error">{{ errorText }}</view>

      <template v-else-if="preview">
        <!-- 这一条是这一页最该被看见的话，所以放在最上面而不是塞进页脚小字 -->
        <view class="demo-banner">演示结算：不接微信支付，提交后订单停在「待付款」，后续状态在订单详情里手动推进</view>

        <!-- ① 收货地址 -->
        <view class="card">
          <view class="card-head">
            <text class="card-title">收货地址</text>
            <text v-if="preview.addresses.length" class="link" @tap="addingAddress = !addingAddress">
              {{ addingAddress ? '取消' : '新增' }}
            </text>
          </view>

          <view
            v-for="addr in preview.addresses"
            :key="addr.id"
            class="addr"
            :class="{ active: addr.id === addressId }"
            @tap="addressId = addr.id"
          >
            <view class="addr-main">
              <view class="addr-line">
                <text class="addr-name">{{ addr.receiver }}</text>
                <text class="addr-phone">{{ addr.phone }}</text>
                <text v-if="addr.isDefault" class="addr-tag">默认</text>
              </view>
              <text class="addr-detail">{{ addr.detail }}</text>
            </view>
            <UiIcon v-if="addr.id === addressId" name="check" :size="32" tone="brand" :stroke-width="2" />
          </view>

          <view v-if="addingAddress" class="addr-form">
            <uv-form
              ref="addressFormRef"
              :model="addressForm"
              :rules="addressRules"
              label-width="150rpx"
              error-type="message"
            >
              <uv-form-item label="收货人" prop="receiver" border-bottom>
                <uv-input v-model="addressForm.receiver" border="none" placeholder="姓名" maxlength="16" />
              </uv-form-item>
              <uv-form-item label="手机号" prop="phone" border-bottom>
                <uv-input
                  v-model="addressForm.phone"
                  border="none"
                  type="number"
                  placeholder="11 位手机号"
                  maxlength="11"
                />
              </uv-form-item>
              <uv-form-item label="详细地址" prop="detail">
                <uv-input
                  v-model="addressForm.detail"
                  border="none"
                  placeholder="省市区 + 街道门牌，写成一行"
                  maxlength="120"
                />
              </uv-form-item>
            </uv-form>
            <text class="form-note">这一版没有省市区三级选择，省市区请写在同一行里</text>
            <view class="btn btn-primary form-btn" @tap="saveAddress">保存地址</view>
          </view>
        </view>

        <!-- ② 商品清单 -->
        <view class="card">
          <view class="card-head">
            <text class="card-title">商品清单</text>
            <text class="card-sub">{{ preview.items.length }} 项</text>
          </view>
          <view v-for="item in preview.items" :key="item.cartId" class="goods">
            <TileImage :src="item.imageUrl" icon="cat-shirt" ratio="1 / 1" class="goods-img" />
            <view class="goods-main">
              <text class="goods-name">{{ item.name }}</text>
              <text class="goods-brand">{{ item.brand || '灵犀甄选' }}</text>
            </view>
            <view class="goods-right">
              <text class="goods-price">¥{{ item.price ?? 0 }}</text>
              <text class="goods-qty">×{{ item.quantity }}</text>
            </view>
          </view>
          <text v-if="preview.unavailableCount" class="warn">
            有 {{ preview.unavailableCount }} 件商品已下架，不计入本单，请回购物车删除
          </text>
        </view>

        <!-- ③ 优惠券 -->
        <view class="card">
          <view class="card-head">
            <text class="card-title">优惠券</text>
            <text class="card-sub">演示券，写死三张</text>
          </view>
          <view
            v-for="c in preview.coupons"
            :key="c.key"
            class="coupon"
            :class="{ active: c.key === couponKey, disabled: !c.usable }"
            @tap="pickCoupon(c.key, c.usable)"
          >
            <view class="coupon-main">
              <text class="coupon-label">{{ c.label }}</text>
              <text class="coupon-reason">{{ c.usable ? `可减 ¥${c.discount}` : c.reason }}</text>
            </view>
            <UiIcon v-if="c.key === couponKey" name="check" :size="30" tone="brand" :stroke-width="2" />
          </view>
        </view>

        <!-- ④ 备注 -->
        <view class="card">
          <view class="card-head"><text class="card-title">订单备注</text></view>
          <textarea v-model="remark" class="remark" maxlength="200" placeholder="选填，例如：工作日送达" />
        </view>

        <view class="amount-card">
          <view class="amount-row">
            <text>商品金额</text>
            <text>¥{{ preview.goodsAmount }}</text>
          </view>
          <view class="amount-row">
            <text>优惠</text>
            <text class="cut">-¥{{ preview.discountAmount }}</text>
          </view>
          <view class="amount-row total">
            <text>实付</text>
            <text class="pay">¥{{ preview.payAmount }}</text>
          </view>
        </view>
      </template>
    </scroll-view>

    <view v-if="preview && !loading" class="bar">
      <view class="bar-sum">
        <text class="bar-label">实付</text>
        <text class="bar-price">¥{{ preview.payAmount }}</text>
      </view>
      <view class="btn btn-primary bar-btn" :class="{ disabled: submitting }" @tap="submit">
        {{ submitting ? '提交中…' : '提交订单' }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.body {
  padding: 12rpx 30rpx 24rpx;
}

.state {
  padding: 120rpx 40rpx;
  color: var(--text-3);
}

.state.error {
  color: var(--danger);
}

.demo-banner {
  padding: 16rpx 22rpx;
  margin-top: 14rpx;
  font-size: 22rpx;
  line-height: 1.55;
  color: var(--text-2);
  background: var(--surface-soft);
  border-radius: var(--radius);
}

.card {
  padding: 22rpx;
  margin-top: 20rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.card-title {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-1);
}

.card-sub {
  font-size: 21rpx;
  color: var(--text-3);
}

.link {
  font-size: 23rpx;
  font-weight: 700;
  color: var(--pink-deep);
}

.addr {
  display: flex;
  gap: 14rpx;
  align-items: center;
  padding: 18rpx;
  margin-bottom: 12rpx;
  background: var(--surface-soft);
  border: 2rpx solid transparent;
  border-radius: var(--radius);
}

.addr.active {
  border-color: var(--pink-deep);
}

.addr-main {
  flex: 1;
  min-width: 0;
}

.addr-line {
  display: flex;
  gap: 14rpx;
  align-items: center;
}

.addr-name {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-1);
}

.addr-phone {
  font-size: 23rpx;
  color: var(--text-2);
}

.addr-tag {
  padding: 2rpx 12rpx;
  font-size: 19rpx;
  color: var(--pink-deep);
  background: var(--pink-soft);
  border-radius: var(--radius-pill);
}

.addr-detail {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--text-3);
}

.addr-form {
  margin-top: 6rpx;
}

.form-note {
  display: block;
  margin-top: 12rpx;
  font-size: 20rpx;
  color: var(--text-3);
}

.form-btn {
  width: 100%;
  margin-top: 16rpx;
}

.goods {
  display: flex;
  gap: 16rpx;
  align-items: center;
  padding: 14rpx 0;
  border-bottom: 1px solid var(--line);
}

.goods:last-of-type {
  border-bottom: none;
}

.goods-img {
  flex-shrink: 0;
  width: 96rpx;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.goods-main {
  flex: 1;
  min-width: 0;
}

.goods-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 25rpx;
  color: var(--text-1);
  white-space: nowrap;
}

.goods-brand {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: var(--text-3);
}

.goods-right {
  flex-shrink: 0;
  text-align: right;
}

.goods-price {
  display: block;
  font-size: 25rpx;
  font-weight: 700;
  color: var(--pink-deep);
}

.goods-qty {
  display: block;
  font-size: 20rpx;
  color: var(--text-3);
}

.warn {
  display: block;
  margin-top: 12rpx;
  font-size: 21rpx;
  color: var(--warning);
}

.coupon {
  display: flex;
  gap: 14rpx;
  align-items: center;
  padding: 16rpx 18rpx;
  margin-bottom: 10rpx;
  background: var(--surface-soft);
  border: 2rpx solid transparent;
  border-radius: var(--radius);
}

.coupon.active {
  border-color: var(--pink-deep);
}

.coupon.disabled {
  opacity: 0.5;
}

.coupon-main {
  flex: 1;
  min-width: 0;
}

.coupon-label {
  display: block;
  font-size: 25rpx;
  font-weight: 500;
  color: var(--text-1);
}

.coupon-reason {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: var(--text-3);
}

.remark {
  width: 100%;
  height: 130rpx;
  padding: 16rpx;
  font-size: 24rpx;
  color: var(--text-1);
  background: var(--surface-soft);
  border-radius: var(--radius);
}

.amount-card {
  padding: 20rpx 22rpx;
  margin-top: 20rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.amount-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0;
  font-size: 24rpx;
  color: var(--text-2);
}

.amount-row.total {
  padding-top: 14rpx;
  margin-top: 6rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-1);
  border-top: 1px solid var(--line);
}

.cut {
  color: var(--pink-deep);
}

.pay {
  font-size: 34rpx;
  color: var(--pink-deep);
}

.bar {
  display: flex;
  flex-shrink: 0;
  gap: 20rpx;
  align-items: center;
  padding: 18rpx 30rpx calc(18rpx + env(safe-area-inset-bottom));
  background: var(--surface);
  box-shadow: var(--shadow-float);
}

.bar-sum {
  flex: 1;
  min-width: 0;
}

.bar-label {
  font-size: 21rpx;
  color: var(--text-3);
}

.bar-price {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: var(--pink-deep);
}

.bar-btn {
  flex-shrink: 0;
  min-width: 220rpx;
}

.bar-btn.disabled {
  opacity: 0.6;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
