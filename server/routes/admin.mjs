import { Router } from 'express'
import { authRequired } from '../middleware/auth.mjs'
import { requireAdmin } from '../middleware/admin.mjs'
import { findById } from '../repositories/userRepo.mjs'
import { listAdminRows, adminOverview, garmentOwner, updateAdminGarment } from '../repositories/adminRepo.mjs'
import { addGarment, deleteGarment } from '../services/wardrobe/garment.mjs'
const router = Router()
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
router.use(authRequired)
router.use(requireAdmin())
router.get(
  '/overview',
  asyncHandler(async (_req, res) => res.json(await adminOverview())),
)
router.get(
  '/:kind',
  asyncHandler(async (req, res) => res.json(await listAdminRows(req.params.kind, req.query))),
)
function garmentInput(body) {
  const name = String(body.name || '').trim()
  const price = Number(body.price)
  if (
    !name ||
    name.length > 32 ||
    !Number.isInteger(price) ||
    price < 0 ||
    price > 1000000 ||
    !['top', 'pants', 'skirt', 'dress', 'shoes', 'bag', 'hat', 'jewelry', 'accessory'].includes(body.category)
  ) {
    throw Object.assign(new Error('请填写有效衣物名称和价格'), { status: 400 })
  }
  return { name, price, category: String(body.category || '').slice(0, 32) }
}
router.post(
  '/garments',
  asyncHandler(async (req, res) => {
    const userId = Number(req.body?.userId)
    if (!Number.isSafeInteger(userId) || userId <= 0 || !(await findById(userId))) {
      return res.status(400).json({ message: '所属用户不存在' })
    }
    res.status(201).json({ item: await addGarment(userId, garmentInput(req.body || {})) })
  }),
)
router.patch(
  '/garments/:id',
  asyncHandler(async (req, res) => {
    const owner = await garmentOwner(req.params.id)
    if (!owner) return res.status(404).json({ message: '衣物不存在' })
    await updateAdminGarment(req.params.id, owner.user_id, garmentInput(req.body || {}))
    res.json({ ok: true })
  }),
)
router.delete(
  '/garments/:id',
  asyncHandler(async (req, res) => {
    const owner = await garmentOwner(req.params.id)
    if (!owner) return res.status(404).json({ message: '衣物不存在' })
    await deleteGarment(owner.user_id, req.params.id)
    res.json({ ok: true })
  }),
)
export default router
