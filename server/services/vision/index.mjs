/**
 * 图像能力服务层的统一出口（阿里百炼 / DashScope）。
 *
 * 原来是 services/ 根目录下平铺的 bailianService.mjs + aiTaskService.mjs 两个文件。
 * 它们本来就是同一件事的两层，收成一个目录：
 *
 *   bailian.mjs  协议适配 —— 能力注册表 + 异步任务创建/轮询/取图。
 *                不碰库、不认识 userId、不做业务校验。
 *   tasks.mjs    业务编排 —— 校验入参 → 交给 bailian 提交 → 落库 → 「查一次并回写」。
 *
 * 依赖方向：bailian ← tasks（单向，bailian 不知道 tasks 存在）。
 *
 * ⚠️ routes/aiTasks.mjs 用 `import * as aiTaskService` 直引 ./tasks.mjs 而不是这个 barrel：
 * 命名空间导入指向 barrel 会把 bailian 的底层函数一起带进来，
 * `aiTaskService.createTask`（bailian 的裸协议调用）就会跟 submitTask 混在一个命名空间里。
 *
 * ⚠️ ESM 不支持目录导入，引用方必须写全 `services/vision/index.mjs`。
 */

export {
  CAPABILITIES,
  getCapability,
  isEnabled,
  getBailianRuntime,
  resolveModel,
  uploadFile,
  isTerminal,
  extractImages,
  createTask,
  fetchTask,
  runTask,
} from './bailian.mjs'
export { submitTask, syncTask, listTasks } from './tasks.mjs'
