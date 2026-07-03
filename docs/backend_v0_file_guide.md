# Protein Network Explorer Backend V0 文件管理说明

## 1. 项目当前目标

本项目当前处于后端 V0 阶段。

当前后端目标是：

```text
读取本地 TSV 数据文件
建立基础查询索引
通过 FastAPI 暴露只读 API
为后续前端网络可视化提供 JSON 数据

当前后端已经完成 7 个核心接口：

GET /api/health

GET /api/search

GET /api/complex/{complex_id}
GET /api/complex/{complex_id}/intra
GET /api/complex/{complex_id}/ext

GET /api/protein/{uniprot_ac}
GET /api/protein/{uniprot_ac}/neighbors
2. 当前项目结构
protein-network-v0/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── datastore.py
│   │   ├── transform.py
│   │   ├── errors.py
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── health.py
│   │       ├── search.py
│   │       ├── complex.py
│   │       └── protein.py
│   ├── scripts/
│   │   ├── audit_files.py
│   │   └── smoke_client.py
│   ├── tests/
│   ├── .env
│   ├── .gitignore
│   └── requirements.txt
│
├── data/
│   ├── ppi_unit_graph/
│   │   ├── ppi_nodes.tsv
│   │   └── ppi_edges.tsv
│   ├── complex_intra_ppi_graph/
│   │   ├── complex_nodes.tsv
│   │   ├── protein_nodes.tsv
│   │   └── intra_edges.tsv
│   └── complex_ext_ppi_graph/
│       ├── complex_nodes.tsv
│       ├── ext_protein_nodes.tsv
│       └── ext_edges.tsv
│
└── docs/
    └── backend_v0_file_guide.md
3. backend 目录说明

backend/ 是后端代码目录。

当前后端技术栈：

Python
FastAPI
pandas
uvicorn
pydantic-settings
httpx
pytest

运行后端时，必须进入 backend/ 目录：

cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

不要在项目根目录直接运行 uvicorn，因为当前 .env 里的数据路径是：

DATA_DIR=../data

这个路径默认从 backend/ 出发。

4. backend/app 目录说明

backend/app/ 是 FastAPI 应用的核心代码目录。

4.1 app/__init__.py

作用：

让 app 目录成为 Python package

这个文件通常保持空文件即可。

不要删除。

4.2 app/main.py

作用：

FastAPI 应用主入口
创建 app 对象
配置 CORS
注册所有 router

当前它负责注册：

app.include_router(health.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(complex.router, prefix="/api")
app.include_router(protein.router, prefix="/api")

也就是说，所有 API 的入口都要从这里接入。

如果以后新增新的模块，例如：

statistics.py
export.py

也需要在 main.py 中导入并注册。

示例：

from app.routers import statistics

app.include_router(statistics.router, prefix="/api")

注意：

main.py 不应该写具体业务逻辑
main.py 只负责创建应用和注册路由
4.3 app/config.py

作用：

读取后端配置
从 .env 中读取 DATA_DIR 和 API_TITLE

当前关键配置：

DATA_DIR=../data
API_TITLE=Protein Network Explorer API

config.py 通过 pydantic-settings 读取 .env。

以后如果加入数据库，可以在这里增加：

NEO4J_URI
NEO4J_USER
NEO4J_PASSWORD
DATABASE_URL

注意：

配置项放 config.py
真实配置值放 .env
不要把密码直接写进 Python 文件
4.4 app/datastore.py

作用：

读取 TSV 文件
把 TSV 加载成 pandas DataFrame
建立基础索引
为 router 提供数据访问入口

当前加载 8 个 TSV：

ppi_unit_graph/ppi_nodes.tsv
ppi_unit_graph/ppi_edges.tsv

complex_intra_ppi_graph/complex_nodes.tsv
complex_intra_ppi_graph/protein_nodes.tsv
complex_intra_ppi_graph/intra_edges.tsv

complex_ext_ppi_graph/complex_nodes.tsv
complex_ext_ppi_graph/ext_protein_nodes.tsv
complex_ext_ppi_graph/ext_edges.tsv

当前建立的主要索引：

ppi_protein_by_uniprot
intra_protein_by_uniprot
ext_protein_by_uniprot
complex_by_id

其中：

ppi_protein_by_uniprot

用于查 ppi_nodes.tsv 里的蛋白。

complex_by_id

用于根据 CORUM complex id 查询复合物。

注意：

router 不应该直接重复读 TSV
所有数据读取都应该从 datastore.py 的 store 获取

当前数据量不大，所以 V0 阶段用 pandas 读入内存是可以的。

未来如果迁移到数据库：

datastore.py 可以从 pandas 版本替换成数据库查询版本
router 的接口格式尽量不要大改
4.5 app/transform.py

作用：

放通用数据转换函数
把原始 TSV 字段转换成前端友好的 JSON
统一处理空值、列表、节点、边格式

当前主要函数：

clean()
first_existing()
split_list()
bool_value()
complex_key()
protein_key()
pair_items()
complex_node()
protein_node()
edge()

其中：

clean()

负责把空字符串、NaN、None 转成：

暂无数据
first_existing()

用于兼容不同 TSV 字段名，比如：

gene_symbol / gene / ext_gene_name
split_list()

用于把分号分隔字段转成数组：

"EZH2;RBBP4;RBBP7"

转成：

["EZH2", "RBBP4", "RBBP7"]
protein_node()
complex_node()
edge()

用于生成前端网络图需要的统一结构：

{
  "data": {
    "id": "...",
    "label": "...",
    "type": "..."
  }
}

注意：

所有节点、边的 JSON 格式都应该尽量通过 transform.py 生成
不要在不同 router 里写很多重复格式转换代码
4.6 app/errors.py

作用：

预留统一错误处理

当前可以先空着。

以后可以放：

自定义 404 错误
自定义数据文件缺失错误
统一异常返回格式

例如未来可以统一返回：

{
  "error": true,
  "message": "...",
  "code": "NOT_FOUND"
}
5. backend/app/routers 目录说明

routers/ 存放具体 API 模块。

原则：

一个业务主题一个 router 文件
不要把所有接口都写进 main.py
5.1 routers/__init__.py

作用：

让 routers 目录成为 Python package

通常保持空文件即可。

不要删除。

5.2 routers/health.py

负责接口：

GET /api/health

作用：

检查后端是否启动成功
检查 8 个 TSV 是否成功加载
返回每个数据表的行数

当前返回示例：

{
  "ok": true,
  "loaded": {
    "ppi_nodes": 1467,
    "ppi_edges": 5944,
    "intra_complex_nodes": 679,
    "intra_protein_nodes": 572,
    "intra_edges": 2511,
    "ext_complex_nodes": 679,
    "ext_protein_nodes": 1300,
    "ext_edges": 54240
  }
}

用途：

每次启动后端后，优先访问 /api/health
确认数据全部加载成功
5.3 routers/search.py

负责接口：

GET /api/search?q={keyword}&type={protein|complex|all}

作用：

统一搜索蛋白和复合物
支持自动补全候选

当前支持：

蛋白 UniProt ID 精确匹配
蛋白 gene_symbol 模糊匹配
蛋白 protein_name 模糊匹配
复合物 complex_id 精确匹配
复合物 name 模糊匹配

示例：

/api/search?q=TP53&type=protein
/api/search?q=EZH2&type=protein
/api/search?q=PRC2&type=complex
/api/search?q=996&type=complex

返回结构：

{
  "query": "TP53",
  "type": "protein",
  "count": 2,
  "results": [
    {
      "type": "protein",
      "id": "P04637",
      "key": "UniProt:P04637",
      "label": "TP53",
      "secondaryLabel": "Cellular tumor antigen p53",
      "category": "TF",
      "matchedBy": "gene_symbol",
      "sourceTable": "ppi_nodes"
    }
  ]
}

注意：

search.py 只负责搜索和候选结果
不要在 search.py 里返回完整图谱
5.4 routers/complex.py

负责复合物相关接口：

GET /api/complex/{complex_id}
GET /api/complex/{complex_id}/intra
GET /api/complex/{complex_id}/ext
5.4.1 GET /api/complex/{complex_id}

作用：

返回复合物基本信息

数据主要来自：

complex_ext_ppi_graph/complex_nodes.tsv
complex_intra_ppi_graph/complex_nodes.tsv

返回内容包括：

复合物 ID
复合物名称
物种
PMID
亚基数
外部 PPI 边数
外部伙伴数
亚基列表
GO 注释
原始字段

示例：

/api/complex/996
5.4.2 GET /api/complex/{complex_id}/intra

作用：

返回复合物内部 PPI 网络

数据来自：

complex_intra_ppi_graph/intra_edges.tsv

当前真实字段包括：

protein1_id
protein2_id
gene1
gene2
complex_ids
complex_names
n_complexes_shared
evidence_in_ppi_graph
sources
methods
publications
supporting_structures
n_ddi
n_dmi
ddi
dmi

注意：

complex_ids 可能包含多个复合物 ID，用分号分隔
因此判断某条边是否属于某个复合物时，不能只用 ==，需要判断 complex_id 是否在 complex_ids 列表里

接口返回：

亚基节点 nodes
内部边 edges
统计 stats

关键字段：

INTRA_PAIR_CONFIRMED
CO_COMPLEX_ONLY

其中：

INTRA_PAIR_CONFIRMED

表示该亚基对有直接 PPI 证据。

CO_COMPLEX_ONLY

表示两个亚基只是共存于同一复合物，但没有独立直接互作证据。

示例：

/api/complex/996/intra

当前测试结果：

{
  "stats": {
    "nodeCount": 5,
    "edgeCount": 10,
    "confirmedEdgeCount": 8,
    "coComplexOnlyEdgeCount": 2
  }
}

这说明 PRC2/3 复合物内部网络返回正确。

5.4.3 GET /api/complex/{complex_id}/ext

作用：

返回复合物外部 PPI 网络

数据来自：

complex_ext_ppi_graph/ext_edges.tsv
complex_ext_ppi_graph/ext_protein_nodes.tsv

当前真实字段包括：

complex_id
complex_name
ext_protein_id
ext_gene_name
mediating_subunit_ids
mediating_subunit_genes
n_mediating_subunits
is_subunit_of_other_complex
other_complex_ids
sources
methods
publications
supporting_structures
n_ddi
n_dmi
ddi
dmi

接口支持分页：

limit
offset

示例：

/api/complex/996/ext?limit=20&offset=0

返回结果示例：

{
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 92,
    "returned": 20,
    "nextOffset": 20
  },
  "stats": {
    "nodeCount": 21,
    "edgeCount": 20
  },
  "truncated": true
}

含义：

复合物 996 总共有 92 条外部 PPI 边
当前返回第一页 20 条
下一页 offset=20

注意：

外部网络边数可能很大
任何前端页面都不应该一次性请求全部外部边
必须使用 limit / offset 或筛选条件
5.5 routers/protein.py

负责蛋白相关接口：

GET /api/protein/{uniprot_ac}
GET /api/protein/{uniprot_ac}/neighbors
5.5.1 GET /api/protein/{uniprot_ac}

作用：

返回单个蛋白详情

数据来源：

ppi_unit_graph/ppi_nodes.tsv
complex_intra_ppi_graph/protein_nodes.tsv
complex_ext_ppi_graph/ext_protein_nodes.tsv
complex_nodes.tsv
ext_edges.tsv

返回内容：

蛋白基础信息
作为亚基所属复合物
作为外部伙伴连接的复合物
HPA 表达画像
原始属性

示例：

/api/protein/Q15910

当前测试结果显示：

Q15910 = EZH2
所属复合物数量 member_complexes count = 10
其中包括 CORUM:996 Polycomb repressive complex 2/3
5.5.2 GET /api/protein/{uniprot_ac}/neighbors

作用：

返回单蛋白中心直接 PPI 邻域网络

数据来自：

ppi_unit_graph/ppi_edges.tsv
ppi_unit_graph/ppi_nodes.tsv

接口支持：

limit

示例：

/api/protein/Q15910/neighbors?limit=20
/api/protein/P04637/neighbors?limit=20

返回内容：

center 中心蛋白
nodes 中心蛋白 + 邻居蛋白
edges 直接 PPI 边
pagination 分页信息
stats 节点边统计

边信息包括：

sources
methods
publications
supporting_structures
nDdi
nDmi
hasDdi
hasDmi
ddi
dmi

注意：

这个接口返回的是前端网络图需要的 JSON
浏览器直接打开会显示很多文字，这是正常的
6. backend/scripts 目录说明

scripts/ 存放开发辅助脚本。

这些脚本不是线上 API，而是开发时手动运行的工具。

6.1 scripts/audit_files.py

作用：

检查 data 目录中的 TSV 文件是否存在
读取每个 TSV
输出行数
输出字段名
输出第一行样例

运行方式：

cd backend
source .venv/bin/activate
python scripts/audit_files.py

用途：

每次替换数据文件后，先运行 audit_files.py
确认字段名没有变化
确认行数合理
确认文件没有放错位置

注意：

如果接口报字段错误，优先运行 audit_files.py 查看真实字段名
6.2 scripts/smoke_client.py

作用：

预留自动化接口冒烟测试脚本

当前可以后续补充。

目标是自动测试：

/api/health
/api/search
/api/complex/996
/api/complex/996/intra
/api/complex/996/ext
/api/protein/Q15910
/api/protein/Q15910/neighbors

以后每次改代码后，只要运行：

python scripts/smoke_client.py

就能确认核心接口没有坏。

7. backend/tests 目录说明

tests/ 用于放正式单元测试和接口测试。

当前可以为空。

未来可以加入：

test_health.py
test_search.py
test_complex.py
test_protein.py

运行方式：

pytest

建议后续把 smoke client 里的核心测试逐步迁移成 pytest 测试。

8. backend/.env

作用：

存放本地运行配置

当前内容：

DATA_DIR=../data
API_TITLE=Protein Network Explorer API

注意：

.env 以后可能包含数据库密码，不应该随便上传公共仓库

如果未来加入 Neo4j，可以增加：

NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
9. backend/.gitignore

作用：

告诉 Git 哪些文件不要提交

当前至少应该包含：

.venv/
__pycache__/
*.pyc
.env.local
.DS_Store
.pytest_cache/

建议补充：

*.log

如果以后 data 文件很大，不想上传 GitHub，可以加：

../data/

但如果数据文件需要随项目一起交付，就不要忽略 data。

10. backend/requirements.txt

作用：

记录 Python 依赖版本

生成方式：

pip freeze > requirements.txt

别人拿到项目后，可以安装：

pip install -r requirements.txt

注意：

每次新增 Python 包后，都要重新 pip freeze > requirements.txt
11. data 目录说明

data/ 是原始数据目录。

原则：

data 里的 TSV 是只读数据
不要在代码运行时修改这些 TSV
不要手动改原始数据内容
如果要清洗数据，应该写 scripts 生成新文件
11.1 data/ppi_unit_graph/

直接 PPI 基本单元图谱。

包含：

ppi_nodes.tsv
ppi_edges.tsv
ppi_nodes.tsv

作用：

蛋白节点表

用于：

蛋白搜索
蛋白详情
蛋白邻域网络节点信息
ppi_edges.tsv

作用：

蛋白之间的直接 PPI 边表

用于：

/api/protein/{uniprot_ac}/neighbors

包含互作证据：

sources
methods
publications
supporting_structures
ddi
dmi
11.2 data/complex_intra_ppi_graph/

复合物内部 PPI 图谱。

包含：

complex_nodes.tsv
protein_nodes.tsv
intra_edges.tsv
complex_nodes.tsv

作用：

复合物节点表

用于：

/api/complex/{complex_id}
蛋白所属复合物查询
protein_nodes.tsv

作用：

复合物内部亚基蛋白节点表

用于：

内部网络节点信息补充
蛋白详情补充
intra_edges.tsv

作用：

复合物内部亚基之间的边表

用于：

/api/complex/{complex_id}/intra

注意：

该表中的 complex_ids 可能是多个复合物 ID，用分号分隔
11.3 data/complex_ext_ppi_graph/

复合物外部 PPI 图谱。

包含：

complex_nodes.tsv
ext_protein_nodes.tsv
ext_edges.tsv
complex_nodes.tsv

作用：

复合物节点表

用于：

/api/complex/{complex_id}
外部网络中心复合物节点
蛋白所属复合物查询
ext_protein_nodes.tsv

作用：

外部蛋白节点表

用于：

/api/complex/{complex_id}/ext
外部蛋白节点信息
ext_edges.tsv

作用：

复合物到外部蛋白的边表

用于：

/api/complex/{complex_id}/ext
/api/protein/{uniprot_ac}

包含：

复合物 ID
外部蛋白 ID
介导亚基
外部蛋白是否属于其他复合物
来源
方法
文献
结构证据
DDI
DMI
12. docs 目录说明

docs/ 用于存放项目文档。

建议至少保留：

docs/backend_v0_file_guide.md
docs/api_contract.md
docs/development_log.md

其中：

backend_v0_file_guide.md

就是本文档，记录每个文件的作用。

api_contract.md

未来用于记录每个接口的请求参数和返回结构。

development_log.md

未来用于记录每次开发改了什么。

13. 当前后端数据流

以 /api/protein/Q15910/neighbors 为例：

浏览器 / 前端
    ↓
GET /api/protein/Q15910/neighbors
    ↓
app/main.py
    ↓
routers/protein.py
    ↓
datastore.py 中的 store.ppi_edges / store.ppi_nodes
    ↓
transform.py 生成 protein_node 和 edge
    ↓
返回 JSON 给前端

以 /api/complex/996/ext 为例：

浏览器 / 前端
    ↓
GET /api/complex/996/ext?limit=20&offset=0
    ↓
app/main.py
    ↓
routers/complex.py
    ↓
datastore.py 中的 store.ext_edges / store.ext_protein_nodes
    ↓
transform.py 生成 complex_node / protein_node / edge
    ↓
返回 nodes + edges + pagination
14. 文件管理规范
14.1 不要乱改 data 文件

data/ 里的 TSV 是原始数据。

不要直接在 Excel 或 VS Code 里手动改。

如果要处理数据，应该：

写脚本
生成新文件
保留原始文件
记录处理过程

推荐格式：

data_raw/
data_processed/

当前 V0 先保持：

data/

即可。

14.2 不要把业务逻辑写进 main.py

main.py 只负责：

创建 FastAPI app
注册 router
配置 CORS

具体逻辑应该放：

routers/search.py
routers/complex.py
routers/protein.py

通用函数应该放：

transform.py

数据读取应该放：

datastore.py
14.3 新增 API 时的文件放置规则

如果新增蛋白相关接口：

/api/protein/...

放到：

routers/protein.py

如果新增复合物相关接口：

/api/complex/...

放到：

routers/complex.py

如果新增搜索相关接口：

/api/search
/api/autocomplete

放到：

routers/search.py

如果新增统计接口：

/api/stats

新建：

routers/statistics.py

并在 main.py 注册。

14.4 字段兼容逻辑统一放在 transform 或 detector 函数里

当前不同 TSV 字段名不完全一致，例如：

complex_id / complex_ids
protein1_id / protein2_id
ext_protein_id
gene_symbol / gene / ext_gene_name

不要在每个地方硬编码太多字段。

优先使用：

first_existing()
detect_xxx_col()

这样后面换数据时更容易维护。

14.5 每次改代码后的检查顺序

每次修改后端代码后，按这个顺序检查：

1. 后端能否启动
2. /api/health 是否 200
3. /api/search 是否能搜 TP53 / EZH2 / PRC2
4. /api/complex/996 是否正常
5. /api/complex/996/intra 是否正常
6. /api/complex/996/ext?limit=20 是否正常
7. /api/protein/Q15910 是否正常
8. /api/protein/Q15910/neighbors?limit=20 是否正常
15. 当前推荐测试 URL
http://localhost:8000/api/health

http://localhost:8000/api/search?q=TP53&type=protein
http://localhost:8000/api/search?q=EZH2&type=protein
http://localhost:8000/api/search?q=PRC2&type=complex
http://localhost:8000/api/search?q=996&type=complex

http://localhost:8000/api/complex/996
http://localhost:8000/api/complex/996/intra
http://localhost:8000/api/complex/996/ext?limit=20&offset=0

http://localhost:8000/api/protein/Q15910
http://localhost:8000/api/protein/Q15910/neighbors?limit=20

http://localhost:8000/api/protein/P04637
http://localhost:8000/api/protein/P04637/neighbors?limit=20
16. 当前完成状态

后端 V0 当前已经完成：

项目结构搭建
虚拟环境创建
依赖安装
8 个 TSV 数据文件加载
/api/health
/api/search
/api/complex/{complex_id}
/api/complex/{complex_id}/intra
/api/complex/{complex_id}/ext
/api/protein/{uniprot_ac}
/api/protein/{uniprot_ac}/neighbors

当前最重要的下一步：

补全 scripts/smoke_client.py
添加自动化接口检查
为前端准备 API contract 文档
开始前端页面设计
17. 后续推荐新增文件

建议下一步新增：

docs/api_contract.md

用途：

专门记录每个 API 的请求参数和返回 JSON 格式
方便前端开发

建议新增：

docs/development_log.md

用途：

记录每次开发进度
避免以后忘记改过什么

建议完善：

backend/scripts/smoke_client.py

用途：

自动测试 7 个核心接口
18. 总结

当前项目文件已经形成清晰分工：

data/       存原始 TSV 数据
backend/    存 FastAPI 后端代码
docs/       存项目说明文档
scripts/    存开发辅助脚本
tests/      存正式测试

后端代码内部也形成清晰分工：

main.py       应用入口
config.py     配置读取
datastore.py  数据加载和索引
transform.py  数据格式转换
routers/      具体 API

后续开发时应保持这个结构，不要把所有逻辑堆到一个文件里。


---

# 二、保存后检查

保存后，在项目根目录运行：

```bash
ls docs

应该看到：

backend_v0_file_guide.md

你也可以在 VS Code 左侧看到：

docs/
└── backend_v0_file_guide.md