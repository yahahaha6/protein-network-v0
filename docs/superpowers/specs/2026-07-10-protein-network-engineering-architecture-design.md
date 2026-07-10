# Protein Network Explorer 工程化架构设计

状态：已吸收原始需求材料，待用户复审
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

本规范以《PPI平台_需求说明》和《TF_EF_PPI图谱整理报告》作为业务与数据语义依据，但不把其中的早期 UI 建议或参考接口视为不可更改的技术设计。需求材料中的数据规模是当时快照，只用于容量与覆盖差异判断，不写成永久业务常量。

平台的核心不是“展示一张图”，而是让研究人员能够在同一套稳定标识下，区分并追溯以下四类信息：物理互作、复合物共成员关系、复合物外部伙伴关系和表达背景。任何视觉编码、筛选和导出都必须保留这些语义差异。

关键决策：

- PostgreSQL 是唯一运行时数据库和权威数据源。
- 不引入 Neo4j、Redis、Kafka、Celery 或微服务。
- 三份核心图谱是 ppi_unit、complex_intra 和 complex_ext；global PPI 是扩展数据集，不反向决定核心合同。
- 基础生物学数据通过受控批次导入，只读发布。
- 研究者可在数据库迁移完成后保存少量独立笔记，但笔记不得覆盖权威数据。
- 近期图查询限制为一跳邻域、共同邻居、2-3 跳扩展和有界最短路径。
- 外部数据格式允许变化，但内部数据库结构和 API 合同保持稳定。
- 不提供未经科学评审的 high/medium/low 综合证据评分；优先透明展示证据构成和推导来源。
- 不进行大爆炸式重构；每个里程碑必须可以独立验证和回滚。

## 2. 目标与非目标

### 2.1 目标

- 修复当前 edge 详情证据空白、矛盾状态和重复字段。
- 明确区分物理互作、共复合物关系、复合物外部伙伴和派生复合物投影。
- 分开交互证据、结构/特征注释、表达上下文和数据推导来源。
- 建立稳定、严格、可生成前端类型的网络响应合同。
- 把 HTTP、业务用例、数据查询和数据规范化分开。
- 允许来源字段名和值形态发生受控变化。
- 搜索完整蛋白/复合物目录，并明确实体在哪些网络中可用或不可用。
- 建立可验证、可回滚、可追溯的数据版本发布流程。
- 将现有文件查询逐路由迁移到 PostgreSQL。
- 保证真实数据不进入 Git、CI、测试夹具或日志。

### 2.2 非目标

- 不建设通用数据映射平台。
- 不支持任意模糊 key 自动猜测。
- 不建设多人协作内容管理系统。
- 不在本阶段实现无限深图遍历或大型图算法。
- 不把 HPA 共表达解释为物理互作证明、概率或边权重。
- 不把“外部蛋白属于其他复合物”直接展示为两个复合物之间的物理 PPI。
- 不把 CORUM 二聚体推导、DDI/DMI 注释和直接实验记录混成同一种证据。
- 不提前实现缓存、物化视图或分布式任务系统。
- 不为自动补全另建服务；统一 search contract 和 PostgreSQL 索引足够。
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

当前还有两处直接可见的后果：backend legend、complex 页面文字 pill 和 NetworkGraph 本地 legend 是三套说明来源，co-complex-only 在 backend 标为 dotted、画布标为 dashed、页面示例只有文字而没有真实线型；edge 详情则由一个通用 buildEdgeDetailData 和固定 JSX 模板渲染，导致 co-membership-only 仍显示 DDI、PDB、来源、方法和文献等不适用的空卡片。

### 3.5 科研关系语义被压平

当前 `complex_intra_ppi` 同时承载“已有直接互作证据”和“仅共处同一复合物”两类边；`complex_external_ppi` 容易被理解成复合物与外部蛋白直接发生物理接触。布尔 flags 可以辅助展示，但不能替代明确的关系类型。

此外，当前 high/medium/low evidenceLevel 根据来源数、文献数、PDB 和 DDI/DMI 自动计算。该规则没有声明来源独立性、DDI/DMI 证据性质和 CORUM 推导规则，不能作为科研结论继续保留。

### 3.6 Search 缺少完整目录和网络可用性

当前搜索遍历多个图节点表并按第一次命中去重。它只能回答“在某个已加载图表中是否找到”，不能回答“实体是否存在于完整目标目录”“在哪些图谱可用”或“为何无法生成网络”。这与需求材料中目标目录大于实际入图集合的事实不一致。

### 3.7 缺失值语义不完整

当前 evidence count 缺失时会被默认转换为 0，HPA profile 的空数组或 null 也无法区分未提供、未富集和不适用。科研 UI 必须把 unknown、明确零值和 not applicable 分开。

## 4. 当前 P0 缺陷

### 4.1 Edge evidence 详情不完整

已确认点击事件可以取得 edge，部分字段也可到达前端。主要合同缺口包括：

- `n_ddi` / `n_dmi` 只用于生成布尔值，具体计数被丢弃；
- 缺失 count 被默认转换为 0，无法保留 unknown；
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

当前 high/medium/low evidenceLevel 从标准合同和主要 UI 中移除。迁移期间若 legacy 数据仍含该字段，只能由 networkAdapter 忽略，不得用于颜色、排序、筛选或科研文案。未来若确有评分需求，必须另行形成带版本、规则说明和领域评审的独立设计。

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

### 4.3 关系与证据语义收口

标准 edge 必须有明确 `relationKind`：

```text
protein_physical_interaction
complex_subunit_pair_supported
complex_subunit_pair_co_membership_only
complex_external_partner
complex_complex_projection
```

`complex_complex_projection` 只允许作为带完整路径的派生查询结果，必须展示连接两个复合物的外部蛋白和介导亚基，不能存成权威物理互作事实。

edge 信息分成四个互不替代的通道：

```text
interactionEvidence  -> sources / methods / publications / structures
featureAnnotations   -> DDI / DMI / domain / motif
expressionContext    -> HPA RNA / IHC / cell type / lineage
provenance           -> source record / derivation rule / dataset version
```

CORUM 二亚基规则必须以 `assertionOrigin=derived` 和明确 `derivationRule` 表达。HPA 作为 edge 数据来源和 HPA 作为 node 表达注释必须使用不同字段与 UI 标题。

### 4.4 图例与详情路线不一致

图例样式只能有一个前端真相源。backend legend 只返回当前响应实际出现的 relationKind、label 和 description 等语义，不返回或决定 color、width、lineStyle；前端 `edgePresentationRegistry` 以 relationKind 为唯一 key，定义 Cytoscape line style、颜色、宽度和 HTML legend swatch。画布与图例必须消费同一个 registry，页面级重复文字 legend 删除。registry 使用穷尽类型映射；新增或未知 relationKind 必须在类型生成、合同测试或运行时边界显式失败，不能静默回退为默认实线。

选择 edge 时允许提高宽度和对比度，但不得把 dashed/dotted 改成 solid。co-membership-only 的画布线型、选中线型和 legend sample 必须一致。

edge detail 不再使用一个通用字段集合。`edgeDetailViewModel` 返回按 relationKind 判别的联合：

```text
ProteinInteractionDetail
ComplexIntraSupportedDetail
ComplexIntraCoMembershipDetail
ComplexExternalPartnerDetail
```

共同 header 只包含端点、relation label 和语义状态。详情路线以 relationKind 穷尽分派，不通过空字段、raw key 或 graphType 猜测；各类型的主体路线为：

| Detail kind | 必须展示 | 有数据时展示 | 不得展示 |
| --- | --- | --- | --- |
| ProteinInteractionDetail | 蛋白端点、物理互作语义 | sources、methods、publications、PDB、DDI/DMI | complex external mediation |
| ComplexIntraSupportedDetail | 亚基端点、当前 complex、direct-PPI 状态 | interaction evidence、shared complexes、PDB、DDI/DMI | external partner mediation |
| ComplexIntraCoMembershipDetail | 亚基端点、当前 complex、共同成员解释 | shared complex count/list、provenance | evidenceLevel，以及空的 sources/methods/publications/PDB/DDI/DMI 区块 |
| ComplexExternalPartnerDetail | complex、external partner、mediating subunits | other-complex memberships、underlying interaction evidence、PDB、DDI/DMI | intra co-membership 文案 |

不适用的 section 完全不渲染，且不能因为某字段为空才推断为不适用。适用但来源未提供明细时，只在对应 section 显示一个由 detailsCompleteness 驱动的紧凑状态，不重复生成多个 “No records” 卡片。Full Edge Fields 从主面板移除，sourcePayload 只保留在折叠 provenance 中。

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

负责一个完整用例，例如搜索目录、获取蛋白邻域、complex intra/ext 网络、typed table rows 或 2-3 跳路径。Service 可以协调 repository 和 normalizer，并返回 API schema。只有出现真实复用时，才提取独立 assembler。

### 5.3 Repository

Repository 按查询能力划分，不按数据库表机械拆分：

- CatalogRepository；
- NetworkRepository；
- EvidenceRepository；
- DatasetRepository；
- NoteRepository（后续）。

Repository 只负责查询和数据库记录映射，不构建 NetworkResponse，也不包含展示文案。

### 5.4 Normalizer

Normalizer 是无 I/O 的纯函数，负责值类型规范化、relationKind、证据通道、缺失状态和 VizNode/VizEdge 构造。Normalizer 不执行来源 key 搜索，不计算未经评审的综合证据等级。

### 5.5 Ingest

Ingest 是唯一允许理解来源文件格式的模块，负责 Source Adapter、key 解析、类型转换、staging、数据质量报告和数据版本发布。

Ingest 还负责两个正交维度：`recordRole` 区分 interaction_evidence、feature_annotation、expression_context 和 provenance；`assertionOrigin` 区分 imported、curated 和 derived。分类规则必须位于 adapter 或显式 derivation rule 中，不能根据字段是否存在临时猜测。

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

key 名称规范化只解决格式漂移，不解决生物学语义漂移。即使两个字段名称相似，只要单位、枚举、证据口径或聚合粒度变化，就必须升级 adapter 并重新验证，不能沿用旧 mapping。

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
- 新导入失败：当前 active release 继续服务。

`import_batches` 还必须记录 adapter 版本、输入文件校验和、导入参数、开始/结束时间和质量报告摘要。同一输入校验和、adapter 版本和参数的重复导入必须可识别，避免无意发布重复版本。

质量报告至少覆盖：主键唯一性、外键完整性、无向边端点规范化、relationKind 可判定性、unknown/zero 冲突、来源覆盖率变化和图谱可用性变化。覆盖率显著变化只报告聚合统计，不输出真实记录。

## 7. PostgreSQL 数据设计

### 7.1 版本与导入

三份核心图谱共享同一基础目录，因此以 release bundle 为发布单位，避免不同图谱指向不一致的数据版本。核心元数据：

```text
dataset_releases
dataset_components
import_batches
active_release
```

版本状态：

```text
staging -> validated -> active -> retired
                    \-> failed
```

第一次实现优先完整不可变快照，以降低回滚和复现复杂度。实现前必须根据行数、索引大小、版本数量和重复比例做容量评估；评估只使用聚合统计，不复制或提交真实记录。只有容量证明不可接受时，才设计事实去重方案。

数据库访问采用同步 SQLAlchemy Core + psycopg，与当前同步 FastAPI 路由保持一致。少量研究用户的负载不值得引入 async 数据访问的额外复杂度；若后续压测证明数据库等待成为实际瓶颈，再以测量结果重新评估。

validated release 切换为 active 必须在单个数据库事务中完成，并通过数据库约束保证任一时刻只有一个 active release。发布失败不得改变当前 active release；回滚通过重新激活已验证的不可变 release 完成。

### 7.2 稳定实体与版本属性

建议核心实体：

```text
proteins
protein_versions
complexes
complex_versions
graph_memberships
complex_memberships
protein_features
protein_expression_profiles
protein_interactions
complex_intra_relations
complex_external_relations
```

`proteins` 和 `complexes` 表示完整目录，不仅包含已经生成网络的实体。`graph_memberships` 记录每个实体在每个数据集/graphType 中的 availability、不可用原因和版本，使 search/detail 可以区分“实体不存在”和“实体存在但当前图谱不可用”。

数据库内部使用 BIGINT 主键；API 只暴露 UniProt、CORUM 等稳定外部标识。无向 PPI 必须规范化端点顺序并通过唯一约束避免重复边。`complex_intra_relations` 和 `complex_external_relations` 独立于 `protein_interactions`，避免把共复合物关系和外部伙伴投影写成物理互作事实。

蛋白名称、序列、长度和单值分类可放在 protein_versions；重复的 domain/motif 区间、GO terms 和 HPA 维度使用带外键的结构化子表。需要筛选、排序、连接或绘制区间轨道的字段不得只存在 JSONB。表可以按存储正规化拆分，但 Repository 仍按查询能力组织，不能机械地一表一个 Repository。

### 7.3 Evidence

`evidence_record` 表示一条原子来源断言。methods、publications、structures 和 features 是其子集合，不允许通过笛卡尔积制造不存在的证据组合。

```text
evidence_records
evidence_methods
evidence_publications
evidence_structures
evidence_features
```

每条 evidence record 至少保留 source、sourceRecordId（如来源提供）、assertionOrigin、derivationRule、dataVersion 和 detailsCompleteness。`detailsCompleteness` 固定为 complete、partial、unavailable 或 unknown。非 derived 记录的 derivationRule 必须为 null。DDI/DMI 放入 feature annotations，不因其存在自动提升 interaction evidence。PDB 结构只有在来源明确映射到当前互作断言时才计入 supporting structures。

核心筛选字段使用正式列；JSONB 只保存来源特有、低频或暂未标准化的 payload。

### 7.4 表达上下文

HPA 表达数据独立于 interaction evidence 建模，至少区分 sc_type、sc_group、protein IHC、tissue-cell enrichment、expression cluster 和 cancer RNA。每个维度包含状态：

```text
available
not_enriched
not_applicable
unknown
```

表达值可以用于筛选和描述性共表达交集，但不得在没有独立、版本化分析方法时生成互作概率或综合边权。

### 7.5 Complex intra/ext

数据库迁移第一版保留当前来源中的 ext/intra 记录和关系类型，不假设其一定可以由 membership 和 PPI 完整推导。完成 parity 和来源语义审计后，才允许将可证明等价的部分改成派生 query/view。

complex intra 必须保留“supported interaction”和“co-membership only”的区别。complex ext 必须保留 mediating subunits、external partner、other-complex memberships 和来源证据。复合物间视图只能由这些路径派生，并返回完整 path provenance。

### 7.6 Catalog Search

统一 search 使用完整 catalog，而不是分别扫描多个网络表。匹配顺序固定为：标准外部 ID exact、gene/alias exact、名称 prefix、名称 trigram。结果返回 matchType、matchedField、availableGraphTypes 和 unavailableReasons。

PostgreSQL 使用规范化 ID/gene 的 B-tree 索引和名称字段的 `pg_trgm` 索引。保留一个 `/search` endpoint，不新建独立 autocomplete 服务；前端 debounce 只减少请求，不替代后端性能测试。

### 7.7 图查询限制

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

每种 edge schema 固定允许的 relationKind，不能只靠布尔 flags 推断：

```text
ProteinInteractionEdge
ComplexIntraSupportedEdge
ComplexIntraCoMembershipEdge
ComplexExternalPartnerEdge
ComplexProjectionEdge（后续派生查询）
```

共享 edge 基础字段只包含 identity、endpoints、relationKind、provenance 和适用于所有关系的不变量。interactionEvidence、featureAnnotations 和 expressionContext 使用独立结构；不适用于某种关系的字段不出现在该具体 schema 中。

Evidence count 遵循 `integer >= 0 | null` 合同，OpenAPI 和生成的 TypeScript 类型必须保留这个区别。前端不得使用 `count || 0` 抹平 unknown 与 zero。

high/medium/low evidenceLevel 不进入新合同。`isConfirmedPpi` 和 `isCoComplexOnly` 只作为 legacy 迁移输入，canonical response 以 relationKind 为唯一真相源。

### 8.2 Search 与详情合同

统一 SearchResponse 返回稳定实体标识、display label、matchType、matchedField、availableGraphTypes 和 unavailableReasons。搜索结果不能暴露 `sourceTable`，因为数据表不是产品语义。

蛋白或复合物存在于 catalog 但网络不可用时，detail endpoint 仍返回 200 和 networkAvailability；对应 network endpoint 返回结构化 409 `NETWORK_UNAVAILABLE`，包含原因和可用替代视图。只有实体本身不在 active catalog 时返回 404。

### 8.3 Metadata 与不变量

每个网络响应包含 `meta.schemaVersion`、`meta.dataVersion` 和 `meta.generatedAt`。

`schemaVersion` 使用语义化版本字符串。增加可选字段为 minor，删除/重命名字段或改变字段语义为 major；`dataVersion` 是当前 active release 的不可变标识，三份核心图谱必须返回同一 release。`raw` 迁移为 `sourcePayload` 时后端只发 canonical 字段，不并行发送两份 payload；过渡兼容仅放在 networkAdapter，并随里程碑 B 删除。

所有网络保证：

- node.id 非空且唯一；
- edge.id 非空且唯一；
- edge.source/target 存在于 nodes；
- stats 返回数量与 nodes/edges 长度一致；
- graphType 与具体响应模型一致；
- graph-specific 核心语义字段完整；
- relationKind 与具体 edge schema 一致；
- co-membership-only 不携带伪造的 interaction evidence；
- projection edge 包含完整派生路径和 derivationRule；
- source/detail count 冲突在响应生成前被拒绝。

### 8.4 分页

网络分页统一以 edge 为单位：limit、offset、totalEdges、returnedEdges、hasMore 和 nextOffset。stats 只描述当前返回页；totalEdges 描述后端过滤后的完整集合。

offset pagination 适合当前已知规模并保持实现简单。只有测量证明深分页成为瓶颈时才改为 cursor，不同时维护两套分页协议。

### 8.5 错误合同

统一 ApiError 包含 code、message、details 和 requestId。404、409、422、503 等非 200 响应必须进入 OpenAPI，不能由各路由手写不同 JSON 形状。

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
- edgePresentationRegistry.ts；
- edgeDetailViewModel.ts；
- networkExport.ts。

纯函数测试稳定后，再依据实际职责拆出 NetworkCanvas 和 EdgeDetailPanel。禁止一次创建大量只包 JSX 的薄组件。

如当前页面仍需接收 legacy network shape，兼容只存在于 networkAdapter 中，并在里程碑 B 的标准合同切换完成后删除。edgeDetailViewModel 只消费 canonical edge，不直接读取 raw/sourcePayload，也不维护第二套来源 key 映射。

前端不根据 raw key、evidenceLevel 或字段是否存在推断 relationKind。`edgePresentationRegistry` 是 edge 颜色、线宽和线型的唯一实现位置；Cytoscape stylesheet、HTML legend 和 selected/dimmed 等纯交互态都只能引用其输出，不能各自复制样式常量，也不能改变 relationKind 表达的线型语义。

### 9.3 详情展示与导出

主详情区先显示共同 header，再由 `edgeDetailViewModel` 的判别字段穷尽分派到对应详情路线，不使用一套固定 section 模板。共享组件只负责标题、字段行、列表、状态和 provenance 折叠等布局原语，不持有关系判定逻辑；每条路线只渲染第 4.4 节定义的适用字段。co-membership-only 必须使用“共同复合物成员，暂无独立互作证据”文案，不能显示 Low evidence PPI，也不能渲染多个不适用证据区块的空状态。

默认隐藏空字段、alias 重复字段、Cytoscape 内部字段、重复统计和 sourcePayload。sourcePayload 只在折叠的 Source provenance 中提供。

Canonical JSON 直接保存完整标准 backend response；viewer elements 仅作为开发调试能力。Canonical export 必须保留 schemaVersion、dataVersion、filters 和 pagination。

### 9.4 表格、导航与查询状态

现有 NetworkAttributeTable 演进为一个 typed NetworkDataTable shell，通过 node/edge/evidence row view-model 提供不同列集；不再创建第二套独立 Evidence Table。表格和画布共享选择状态，但表格筛选不暗中改变后端网络集合。

筛选、中心实体、分页和视图类型保存在 URL query 中，保证刷新、分享和导出可复现。网络漫游使用可见的“设为中心”命令并写入浏览器历史；双击只可作为可选快捷方式，不能是唯一入口。

complex intra 和 ext 默认使用同一复合物页面下的切换视图与明确交叉链接，不默认叠加在一个画布。复合物间 projection 以后作为独立派生视图实现。

SVG 和结构化 CSV/TSV 导出在 canonical contract 稳定后增加。CSV/TSV 导出使用 typed table rows，不导出任意 Cytoscape/raw 字段。

## 10. 测试策略

### 10.1 单元与合同测试

- key resolver 和 source adapters；
- value/evidence normalizers；
- relationKind、assertionOrigin 和 derivationRule；
- expression status 和 interaction/context 分离；
- network builders；
- edge presentation registry 与 legend/canvas 样式一致性；
- edge detail view-model；
- 四种 edge detail 判别联合及 section 适用性；
- 字段筛选与 alias 去重；
- canonical export；
- graph-specific Pydantic models；
- catalog search ranking 和 graph availability；
- 网络不变量与 error responses；
- OpenAPI schema。

### 10.2 PostgreSQL 集成测试

必须使用 PostgreSQL，不以 SQLite 替代。覆盖 repository query、constraints、transactions、JSONB、`pg_trgm` search、递归查询和 active release 原子切换。

### 10.3 Route、浏览器与 parity

- synthetic repository + TestClient；
- 四类网络 200/404/409/422/503；
- 点击 node/edge；
- evidence 明细、count-only、supported-with-unknown-count 和 no-evidence 四种状态；
- physical interaction、co-membership 和 external partner 不互相误标；projection 在对应后续功能实现时加入同一合同测试；
- co-membership 的 legend sample、未选中画布和选中画布都保持同一 dashed 线型；
- co-membership detail 不出现 sources、methods、publications、PDB、DDI/DMI 等不适用空卡片；
- external partner detail 优先显示 mediating subunits、external partner 和 other-complex memberships；
- catalog exists/network unavailable 与 entity not found 分开；
- HPA not_enriched、not_applicable 和 unknown 分开；
- 无重复 alias；
- canonical export；
- desktop/mobile Playwright 截图覆盖 edge legend 和四种详情路线；
- File/PostgreSQL graphType、IDs、生物学语义、evidence、filters、stats 和 pagination parity。

排序差异应先规范化排序，不允许通过删除语义字段让 parity 测试通过。

### 10.4 性能验收

使用 synthetic scale fixture 和只含聚合结果的本地容量报告测试预期规模。search/autocomplete 在目标部署环境以 p95 < 300ms 为目标；网络接口同时验证响应时间、maxNodes/maxEdges 和前端渲染上限。性能不达标时先使用 EXPLAIN ANALYZE、索引和查询改写，不能直接引入缓存或新数据库。

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

测试 fixture 必须包含语义边界样本：明确零值、unknown、co-membership-only、derived CORUM rule、HPA expression context、同名不同实体和 catalog 存在但网络不可用。不得只使用全字段齐全的理想记录。

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

里程碑 A 的实施计划按 A1 evidence/count、A2 relation/provenance contract、A3 frontend presentation/detail/export 三个提交序列执行，避免在一个改动中同时重写后端和大型前端组件。

- 修复 edge evidence 详情完整性；
- 修复 count-only evidence 的矛盾状态；
- 保留 count 的 positive/zero/unknown 三态；
- 隔离 sourcePayload 并去除重复字段；
- 引入 relationKind，明确区分 physical interaction、co-membership 和 external partner；
- 将 interaction evidence、feature annotations、expression context 和 provenance 分开；
- 从标准合同和主要 UI 移除 high/medium/low evidenceLevel；
- 为四类网络建立 graph-specific response/edge models，并提升 schemaVersion major；
- 提取 edgePresentationRegistry、edgeDetailViewModel 和 networkExport 纯函数；
- 删除页面文字 pill、backend 视觉字段和 NetworkGraph 本地样式之间的重复图例真相源；
- 按 relationKind 分流四种 edge detail，隐藏不适用区块；
- 完成当前 NetworkResponse route/contract tests；
- 修复 canonical export。

退出条件：四类网络点击 edge 的 synthetic/browser tests 全部通过，无核心 raw fallback，不再把 co-membership 显示为低证据 PPI，证据 unknown 不显示为零；legend sample 与画布线型一致且选择 edge 不改变其虚实语义；co-membership 和 external partner 详情只显示各自适用字段。

### B. 建立边界，保持 A 基线

- app factory、lifespan 和 dependency injection；
- Repository protocols；
- 现有 DataStore 的临时 FileNetworkRepository adapter；
- Router -> Service -> Repository；
- search/detail/network 用例边界明确；
- OpenAPI 在无真实数据环境中可生成；
- generated TypeScript types 和 schema drift check 接入前端/CI。

退出条件：里程碑 A 建立的 canonical API 行为保持一致，route tests 不读取真实数据。

### C. PostgreSQL 数据入口

- SQLAlchemy Core、Alembic 和 PostgreSQL schema；
- explicit source adapters；
- staging、validation report 和 version publish；
- 完整 protein/complex catalogs 和 graph availability；
- 独立 protein interaction、complex intra、complex ext 关系表；
- evidence、feature annotation 和 HPA expression context；
- PostgreSQL catalog search 和索引；
- PostgreSQL repositories；
- synthetic PostgreSQL integration tests；
- file/PostgreSQL parity tests。

退出条件：所有核心路由在 synthetic 数据上达到语义 parity，目录实体不会因未入图而消失，relationKind 与 provenance 完整，新 release 失败不会影响 active release。

### D. 逐路由切换并删除旧路径

切换顺序：

1. health/readiness 和 catalog search；
2. protein/complex detail；
3. ppi_unit protein neighbors；
4. complex intra；
5. complex ext；
6. global PPI neighbors。

每个路由切换后必须删除对应文件查询路径，不能永久双实现。

退出条件：运行时不再读取 TSV/JSON，模块级 DataStore/GlobalPPIStore 被删除，PostgreSQL 成为唯一数据源。

## 14. 产品功能顺序

里程碑 D 完成后，优先补齐科研读取体验，再增加图算法：

1. 将现有 NetworkAttributeTable 改造成 typed NetworkDataTable，并提供 evidence columns；
2. 完整蛋白详情，包括 HPA expression profile、domain/motif 轨道和权威外链；
3. complex intra/ext 之间的介导亚基追踪、交叉链接和可解释切换；
4. SVG 和结构化 CSV/TSV 导出，保留 dataVersion、中心实体和 filters；
5. 研究笔记，前提是可信用户标识已确定；
6. 共同邻居、2-3 跳扩展和有界最短路径；
7. 复合物间 projection，必须返回完整派生路径。

只有性能数据证明需要时才增加物化视图。domain/motif 轨道和 HPA profile 是现有数据的解释视图，不新建独立分析服务。

## 15. 防止代码再次堆积的硬规则

- 一个业务规则只能有一个实现位置；
- relationKind 是关系语义唯一真相源，legacy flags 不并行长期保留；
- Router 不处理来源 key、SQL 和 biological semantics；
- 核心合同不使用开放字典；
- sourcePayload 不参与核心展示；
- interaction evidence、feature annotation 和 expression context 不互相代替；
- 不提供未经版本化和领域评审的综合证据评分；
- derived projection 不伪装成权威物理互作；
- 不创建只转发参数的 wrapper；
- 不为 autocomplete、Evidence Table 或 HPA profile 重建平行基础设施；
- 没有真实第二个使用者，不提前提取通用抽象；
- 不按数据库表机械创建 Repository；
- 过渡代码必须绑定删除里程碑；
- 新阶段开始前，上一阶段测试和删除条件必须完成；
- 未知或冲突 key 不静默猜测；
- 不以“程序能运行”为理由吞掉数据错误；
- 不把缺失证据展示成不存在的证据；
- 每次提出新方案前，先反向检查过度设计、重复真相源、迁移残留和实际业务价值。

## 16. 验收标准

以下是目标态总验收标准。每个里程碑只承担第 13 节列出的相关子集；尚未进入实施顺序的 projection、笔记和图算法不阻塞里程碑 A-D。

- 点击任意 edge 时，有数据的字段正确展示，无数据状态语义准确；
- evidence 的 zero、positive 和 unknown 不互相混淆；
- physical interaction、co-membership、external partner 和 projection 不互相混淆；
- edge legend 与画布消费同一 presentation registry，co-membership 在线例、未选中和选中状态都保持 dashed；
- edge detail 按 relationKind 使用判别联合分流，不适用 section 不渲染；
- co-membership detail 不显示空的 interaction evidence、PDB、DDI/DMI、sources、methods 或 publications 卡片；
- external partner detail 优先展示 mediating subunits、external partner 和 other-complex memberships；
- canonical response 不包含 high/medium/low 综合证据等级；
- CORUM 推导记录带 assertionOrigin 和 derivationRule；
- DDI/DMI 不被当作直接实验或 PDB 结构证据；
- HPA interaction source 与 HPA expression context 分开；
- HPA available、not_enriched、not_applicable 和 unknown 可区分；
- 不再显示 snake_case/camelCase 重复字段；
- sourcePayload 保持 parser 读入后的来源字段和值原样且默认折叠；
- 已知 key/value 形态变化经 adapter 后 API 格式不变；
- 未知或冲突映射不会污染 active release；
- 四类网络均使用具体、严格的 response model；
- search 覆盖 active catalog，并返回 graph availability；
- catalog 中存在但网络不可用不会被错误返回为 entity not found；
- OpenAPI 和前端生成类型无漂移；
- Router 不直接读取文件或数据库；
- PostgreSQL 是唯一运行时数据源；
- canonical export 包含 schemaVersion 和 dataVersion；
- CI 不读取真实数据；
- `git ls-files data` 无输出；
- 文件查询过渡实现按里程碑删除，不形成永久双系统。
- 当前规模下 search p95 达到 300ms 目标，网络响应遵守 maxNodes/maxEdges。
