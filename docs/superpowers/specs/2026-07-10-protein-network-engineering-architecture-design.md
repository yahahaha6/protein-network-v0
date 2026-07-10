# Protein Network Explorer 工程化架构设计

状态：待用户最终审阅
日期：2026-07-10
适用项目：Protein Network Explorer V1 及后续数据库迁移

## 1. 决策摘要

目标状态采用 PostgreSQL-only 的模块化单体架构。迁移期间允许文件查询作为有明确删除期限的兼容实现，但不得成为长期双数据源。

```text
Next.js
  -> FastAPI Router
  -> Application Service
  -> Repository
  -> PostgreSQL

Application Service
  -> Normalizer / Response Builder
  -> Graph-specific NetworkResponse
```

关键决策：

- PostgreSQL 是唯一运行时数据库和权威数据源。
- 不引入 Neo4j、Redis、Kafka、Celery 或微服务。
- 基础生物学数据通过受控批次导入，只读发布。
- 研究者可在数据库迁移完成后保存少量独立笔记，但笔记不得覆盖权威数据。
- 近期图查询限制为一跳邻域、共同邻居、2-3 跳扩展和有界最短路径。
- 外部数据格式允许变化，但内部数据库结构和 API 合同保持稳定。
- 不进行大爆炸式重构；每个里程碑必须可以独立验证和回滚。

## 2. 目标与非目标

### 2.1 目标

- 修复当前 edge 详情证据空白、矛盾状态和重复字段。
- 建立稳定、严格、可生成前端类型的网络响应合同。
- 把 HTTP、业务用例、数据查询和数据规范化分开。
- 允许来源字段名和值形态发生受控变化。
- 建立可验证、可回滚、可追溯的数据版本发布流程。
- 将现有文件查询逐路由迁移到 PostgreSQL。
- 保证真实数据不进入 Git、CI、测试夹具或日志。

### 2.2 非目标

- 不建设通用数据映射平台。
- 不支持任意模糊 key 自动猜测。
- 不建设多人协作内容管理系统。
- 不在本阶段实现无限深图遍历或大型图算法。
- 不提前实现缓存、物化视图或分布式任务系统。
- 不一次性拆分所有大型文件。

## 3. 当前代码问题

### 3.1 路由职责过重

当前 protein、complex 和 global PPI 路由同时承担文件查询、字段别名解析、数据类型转换、生物学语义判断、后端过滤、网络统计、响应组装和 HTTP 错误处理。

这些职责必须渐进拆分，但不得一次跨多个高风险模块重写。

### 3.2 导入时读取真实数据

`DataStore` 和 `GlobalPPIStore` 目前在模块导入时初始化。其结果是：

- OpenAPI 生成依赖真实数据；
- TestClient 难以注入 synthetic fixture；
- 相对 DATA_DIR 依赖进程工作目录；
- app import 可能直接失败；
- 后续 PostgreSQL 切换缺少可替换边界。

### 3.3 网络合同过宽

当前单一 NetworkResponse 允许大量默认值和可选字段。它可以统一 JSON 外壳，但不足以保证不同 graphType 的核心语义。

### 3.4 前端组件职责过重

NetworkGraph 同时负责标准/legacy 数据适配、Cytoscape 生命周期、语义解释、视觉映射、点击详情、legend 和导出。

重构应先提取纯函数，再依据测试边界拆组件。

## 4. 当前 P0 缺陷

### 4.1 Edge evidence 详情不完整

已确认点击事件可以取得 edge，部分字段也可到达前端。主要合同缺口包括：

- `n_ddi` / `n_dmi` 只用于生成布尔值，具体计数被丢弃；
- 前端读取顶层 `gold_record_count`，后端实际保存在 `evidenceSummary.goldRecordCount`；
- 当前没有测试保护标准 VizEdge 经过 adapter 和点击详情后仍保持 evidence 字段；
- UI 无法区分“没有证据”和“有汇总计数但来源未提供明细”。

目标状态：

```text
count > 0 and details available
  -> display details

count > 0 and details unavailable
  -> display reported count and an explicit unavailable-detail message

count == 0
  -> display no evidence
```

EvidenceSummary 至少包含 sourceCount、methodCount、publicationCount、structureCount、ddiRecordCount、dmiRecordCount 和 goldRecordCount。

所有 count 字段使用“非负整数或 null”，不得用 `0` 代替未知：

- `0` 表示来源明确报告没有记录；
- 正整数表示来源报告的记录数；
- `null` 表示来源没有提供计数。

`ddiSupported` / `dmiSupported` 与 count 分开表达。supported 为 true 但 count 为 null 时，UI 显示“来源报告支持，但未提供记录数”；只有来源明确提供零值且没有支持标记时，才显示“无证据”。

`supported=true` 与 count=0，或 count=0 与非空 details，均属于合同冲突，必须由 normalizer/contract test 拦截，不能交给 UI 猜测。reported count 与部分 details 数量不必强制相等，但 UI 必须明确 details 是否完整。

### 4.2 详情字段重复

后端当前把来源 row 复制进 raw 后，又追加 camelCase 标准字段。例如 raw 同时出现：

```text
complex_id / complexId
complex_name / complexName
ext_gene_name / externalPartnerGene
```

前端 DetailFields 将这些 key 格式化成相同标题，但只过滤空值，不做语义别名去重。

目标状态：

- sourcePayload 只保存 parser 读入后的原始来源字段和值，不注入 canonical alias，也不承诺保留文件字节级格式；
- 标准字段只存在于 VizNode/VizEdge 顶层；
- 主详情区域只展示精选标准字段；
- sourcePayload 默认折叠，仅用于追溯；
- 后端 Source Adapter 的显式 alias group 负责兼容来源变化；前端 core view-model 不解析来源 alias；
- alias 值冲突不得静默覆盖。

## 5. 最小充分模块结构

```text
backend/app/
├── api/
├── schemas/
├── services/
├── repositories/
├── normalizers/
├── ingest/
├── db/
├── config.py
├── errors.py
└── main.py
```

### 5.1 API Router

只负责 HTTP 参数、FastAPI dependency、response_model、调用 service，以及将领域错误映射为统一 ApiError。

禁止 Router 读取 DataFrame、执行 SQL、访问模块级 store、解析来源 key 或计算 evidence/图统计。

### 5.2 Service

负责一个完整用例，例如获取蛋白邻域、complex intra/ext 网络、Evidence Table 或 2-3 跳路径。Service 可以协调 repository 和 normalizer，并返回 API schema。只有出现真实复用时，才提取独立 assembler。

### 5.3 Repository

Repository 按查询能力划分，不按数据库表机械拆分：

- CatalogRepository；
- NetworkRepository；
- EvidenceRepository；
- DatasetRepository；
- NoteRepository（后续）。

Repository 只负责查询和数据库记录映射，不构建 NetworkResponse，也不包含展示文案。

### 5.4 Normalizer

Normalizer 是无 I/O 的纯函数，负责值类型规范化、生物学语义字段、evidence summary 和 VizNode/VizEdge 构造。

### 5.5 Ingest

Ingest 是唯一允许理解来源文件格式的模块，负责 Source Adapter、key 解析、类型转换、staging、数据质量报告和数据版本发布。

## 6. 数据格式漂移兼容

### 6.1 原则

```text
变化的外部数据
  -> Source Adapter
  -> deterministic key resolution
  -> canonical import record
  -> validation
  -> PostgreSQL
```

Router、Service、Repository 和前端不得读取来源 key。

### 6.2 Key 解析顺序

1. 完全相同 key；
2. 大小写、camelCase/snake_case 规范化后完全相同；
3. 显式 alias；
4. 数据源专属 mapping；
5. 无法唯一确定时报告 warning 或拒绝导入。

允许确定性兼容 `supportingStructures`、`supporting_structures`、`Supporting Structures` 和 `supporting-structures`。

禁止将语义不同的 `source`、`source_name`、`source_database` 和 `source_protein` 自动合并。

每个 canonical 字段只能选中一个来源 key；同一个来源 key 也不得同时供给两个 canonical 字段，除非 adapter 代码明确声明并有测试。多个 alias 同时存在且值不一致时视为冲突，不按 alias 顺序静默取第一个。

### 6.3 Adapter 范围

第一版只提供现有数据源的显式 adapter：

- PpiUnitAdapter；
- GlobalPpiAdapter；
- ComplexIntraAdapter；
- ComplexExternalAdapter。

不建设动态规则编辑器，不将映射规则存成可任意修改的数据库配置。

### 6.4 导入报告与失败策略

每次导入记录 canonical key、matched source key、匹配方式、缺失/冲突、转换失败的行号和值，以及严重级别。

- 必需字段缺失或冲突：拒绝发布；
- 可选字段缺失：允许导入并记录 warning；
- 未知额外字段：保存进 sourcePayload；
- 新导入失败：当前 active version 继续服务。

`import_batches` 还必须记录 adapter 版本、输入文件校验和、导入参数、开始/结束时间和质量报告摘要。同一输入校验和、adapter 版本和参数的重复导入必须可识别，避免无意发布重复版本。

## 7. PostgreSQL 数据设计

### 7.1 版本与导入

核心元数据：

```text
dataset_versions
import_batches
active_dataset
```

版本状态：

```text
staging -> validated -> active -> retired
                    \-> failed
```

第一次实现优先完整不可变快照，以降低回滚和复现复杂度。实现前必须根据行数、索引大小、版本数量和重复比例做容量评估；评估只使用聚合统计，不复制或提交真实记录。只有容量证明不可接受时，才设计事实去重方案。

数据库访问采用同步 SQLAlchemy Core + psycopg，与当前同步 FastAPI 路由保持一致。少量研究用户的负载不值得引入 async 数据访问的额外复杂度；若后续压测证明数据库等待成为实际瓶颈，再以测量结果重新评估。

validated 版本切换为 active 必须在单个数据库事务中完成，并通过数据库约束保证任一时刻只有一个 active version。发布失败不得改变当前 active version；回滚通过重新激活已验证的不可变版本完成。

### 7.2 稳定实体与版本属性

建议核心实体：

```text
proteins
protein_versions
complexes
complex_versions
complex_memberships
protein_interactions
```

数据库内部使用 BIGINT 主键；API 只暴露 UniProt、CORUM 等稳定外部标识。无向 PPI 必须规范化端点顺序并通过唯一约束避免重复边。

### 7.3 Evidence

`evidence_record` 表示一条原子来源记录。methods、publications、structures 和 features 是其子集合，不允许通过笛卡尔积制造不存在的证据组合。

```text
evidence_records
evidence_methods
evidence_publications
evidence_structures
evidence_features
```

核心筛选字段使用正式列；JSONB 只保存来源特有、低频或暂未标准化的 payload。

### 7.4 Complex intra/ext

数据库迁移第一版保留当前来源中的 ext/intra 事实语义，不假设其一定可以由 membership 和 PPI 完整推导。完成 parity 和来源语义审计后，才允许将可证明等价的部分改成派生 query/view。

### 7.5 图查询限制

- maxDepth <= 3；
- maxNodes 和 maxEdges 使用配置上限；
- 设置 statement timeout；
- 递归查询记录 path 并检测循环；
- 使用稳定排序；
- 未经过 EXPLAIN ANALYZE 不创建物化视图。

## 8. API 合同

### 8.1 具体响应模型

每个网络路由使用具体 response model，共享基础字段，但不依赖包含全部可选语义的万能模型：

```text
ProteinNeighborhoodResponse
GlobalPpiNeighborhoodResponse
ComplexIntraResponse
ComplexExternalResponse
ProteinPathResponse（后续）
```

每个模型固定 graphType，并明确 edge、filters、stats 和 pagination 类型。规范化 API 模型使用 `extra="forbid"`；sourcePayload 是唯一明确开放的来源字段容器。

Evidence count 遵循 `integer >= 0 | null` 合同，OpenAPI 和生成的 TypeScript 类型必须保留这个区别。前端不得使用 `count || 0` 抹平 unknown 与 zero。

### 8.2 Metadata 与不变量

每个网络响应包含 `meta.schemaVersion`、`meta.dataVersion` 和 `meta.generatedAt`。

`schemaVersion` 使用语义化版本字符串。增加可选字段为 minor，删除/重命名字段或改变字段语义为 major；`dataVersion` 是不可变数据快照标识。`raw` 迁移为 `sourcePayload` 时后端只发 canonical 字段，不并行发送两份 payload；过渡兼容仅放在 networkAdapter，并随里程碑 B 删除。

所有网络保证：

- node.id 非空且唯一；
- edge.id 非空且唯一；
- edge.source/target 存在于 nodes；
- stats 返回数量与 nodes/edges 长度一致；
- graphType 与具体响应模型一致；
- graph-specific 核心语义字段完整。

### 8.3 分页

网络分页统一以 edge 为单位：limit、offset、totalEdges、returnedEdges、hasMore 和 nextOffset。stats 只描述当前返回页；totalEdges 描述后端过滤后的完整集合。

### 8.4 错误合同

统一 ApiError 包含 code、message、details 和 requestId。404、422、503 等非 200 响应必须进入 OpenAPI，不能由各路由手写不同 JSON 形状。

## 9. 前端边界

### 9.1 类型流

```text
OpenAPI
  -> generated/api-schema.ts
  -> apiTypes.ts
  -> apiClient.ts
```

组件不得再声明第二套 StandardNetworkResponse，也不得长期使用开放字典作为核心合同。

### 9.2 渐进拆分

第一步只提取：

- networkAdapter.ts；
- edgeDetailViewModel.ts；
- networkExport.ts。

纯函数测试稳定后，再依据实际职责拆出 NetworkCanvas 和 EdgeDetailPanel。禁止一次创建大量只包 JSX 的薄组件。

如当前页面仍需接收 legacy network shape，兼容只存在于 networkAdapter 中，并在里程碑 B 的标准合同切换完成后删除。edgeDetailViewModel 只消费 canonical edge，不直接读取 raw/sourcePayload，也不维护第二套来源 key 映射。

### 9.3 详情展示与导出

主详情区展示 interaction identity、biological interpretation、evidence summary、evidence details 和 source provenance。

默认隐藏空字段、alias 重复字段、Cytoscape 内部字段、重复统计和 sourcePayload。sourcePayload 只在折叠的 Source provenance 中提供。

Canonical JSON 直接保存完整标准 backend response；viewer elements 仅作为开发调试能力。Canonical export 必须保留 schemaVersion、dataVersion、filters 和 pagination。

## 10. 测试策略

### 10.1 单元与合同测试

- key resolver 和 source adapters；
- value/evidence normalizers；
- network builders；
- edge detail view-model；
- 字段筛选与 alias 去重；
- canonical export；
- graph-specific Pydantic models；
- 网络不变量与 error responses；
- OpenAPI schema。

### 10.2 PostgreSQL 集成测试

必须使用 PostgreSQL，不以 SQLite 替代。覆盖 repository query、constraints、transactions、JSONB、递归查询和 active version 原子切换。

### 10.3 Route、浏览器与 parity

- synthetic repository + TestClient；
- 四类网络 200/404/422/503；
- 点击 node/edge；
- evidence 明细、count-only、supported-with-unknown-count 和 no-evidence 四种状态；
- 无重复 alias；
- canonical export；
- File/PostgreSQL graphType、IDs、生物学语义、evidence、filters、stats 和 pagination parity。

排序差异应先规范化排序，不允许通过删除语义字段让 parity 测试通过。

## 11. CI 与数据安全

CI 只使用 synthetic data，并执行：

```text
git diff --check
git ls-files data
backend tests
PostgreSQL integration tests
OpenAPI/type drift check
frontend lint/test/build
critical Playwright tests
```

`git ls-files data` 必须无输出。

禁止提交真实 data、真实 sourcePayload、真实导入日志样本，或含真实数据的浏览器导出和测试快照。

## 12. 部署与运行

面向少量研究人员，采用单机或实验室服务器上的 Docker Compose：

```text
reverse proxy
frontend
FastAPI
PostgreSQL
```

运行要求：Alembic 管理结构迁移；独立 import CLI 管理数据发布；FastAPI lifespan 初始化连接池；提供 live/ready health；日志不记录完整 sourcePayload；定期 pg_dump 并执行恢复演练；查询、导入、备份使用不同数据库账号。

本阶段不自建用户系统。只读查询可由实验室网络或反向代理保护；开始实现研究笔记前，必须先确定可信用户标识来源，否则笔记功能不得上线。

## 13. 四个迁移里程碑

本文件是总体架构规范，不对应一份覆盖全部迁移的大型实施计划。A、B、C、D 各自编写、审阅和执行独立计划；下一份实施计划只覆盖里程碑 A。只有当前里程碑满足退出条件，才规划下一里程碑。

### A. 修复并锁定当前行为

- 修复 edge evidence 详情完整性；
- 修复 count-only evidence 的矛盾状态；
- 隔离 sourcePayload 并去除重复字段；
- 提取 edgeDetailViewModel 和 networkExport 纯函数；
- 完成当前 NetworkResponse route/contract tests；
- 修复 canonical export。

退出条件：四类网络点击 edge 的 synthetic/browser tests 全部通过，且无核心 raw fallback。

### B. 建立边界，不改变行为

- app factory、lifespan 和 dependency injection；
- Repository protocols；
- 现有 DataStore 的临时 FileNetworkRepository adapter；
- Router -> Service -> Repository；
- OpenAPI 在无真实数据环境中可生成。

退出条件：当前 API 行为保持一致，route tests 不读取真实数据。

### C. PostgreSQL 数据入口

- SQLAlchemy Core、Alembic 和 PostgreSQL schema；
- explicit source adapters；
- staging、validation report 和 version publish；
- PostgreSQL repositories；
- synthetic PostgreSQL integration tests；
- file/PostgreSQL parity tests。

退出条件：所有核心路由在 synthetic 数据上达到语义 parity，新版本失败不会影响 active version。

### D. 逐路由切换并删除旧路径

切换顺序：

1. protein neighbors；
2. complex intra；
3. complex ext；
4. global PPI neighbors；
5. detail/search/health。

每个路由切换后必须删除对应文件查询路径，不能永久双实现。

退出条件：运行时不再读取 TSV/JSON，模块级 DataStore/GlobalPPIStore 被删除，PostgreSQL 成为唯一数据源。

## 14. 后续功能顺序

数据库迁移完成后再实施 Evidence Table、研究笔记、共同邻居、2-3 跳扩展和有界最短路径。只有性能数据证明需要时才增加物化视图。

## 15. 防止代码再次堆积的硬规则

- 一个业务规则只能有一个实现位置；
- Router 不处理来源 key、SQL 和 biological semantics；
- 核心合同不使用开放字典；
- sourcePayload 不参与核心展示；
- 不创建只转发参数的 wrapper；
- 没有真实第二个使用者，不提前提取通用抽象；
- 不按数据库表机械创建 Repository；
- 过渡代码必须绑定删除里程碑；
- 新阶段开始前，上一阶段测试和删除条件必须完成；
- 未知或冲突 key 不静默猜测；
- 不以“程序能运行”为理由吞掉数据错误；
- 不把缺失证据展示成不存在的证据；
- 每次提出新方案前，先反向检查过度设计、重复真相源、迁移残留和实际业务价值。

## 16. 验收标准

- 点击任意 edge 时，有数据的字段正确展示，无数据状态语义准确；
- evidence 的 zero、positive 和 unknown 不互相混淆；
- 不再显示 snake_case/camelCase 重复字段；
- sourcePayload 保持 parser 读入后的来源字段和值原样且默认折叠；
- 已知 key/value 形态变化经 adapter 后 API 格式不变；
- 未知或冲突映射不会污染 active version；
- 四类网络均使用具体、严格的 response model；
- OpenAPI 和前端生成类型无漂移；
- Router 不直接读取文件或数据库；
- PostgreSQL 是唯一运行时数据源；
- canonical export 包含 schemaVersion 和 dataVersion；
- CI 不读取真实数据；
- `git ls-files data` 无输出；
- 文件查询过渡实现按里程碑删除，不形成永久双系统。
