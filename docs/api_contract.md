# Protein Network Explorer API Contract

## 1. 基本信息

后端地址：

```text
http://localhost:8000

API 文档地址：

http://localhost:8000/docs

当前后端版本：

0.1.0

当前所有接口都是只读接口，前端只需要发送 GET 请求。

2. 接口总览
GET /api/health

GET /api/search?q={keyword}&type={protein|complex|all}

GET /api/protein/{uniprot_ac}
GET /api/protein/{uniprot_ac}/neighbors

GET /api/complex/{complex_id}
GET /api/complex/{complex_id}/intra
GET /api/complex/{complex_id}/ext
3. GET /api/health
用途

检查后端是否正常启动，检查 8 个 TSV 数据文件是否成功加载。

请求示例
GET /api/health
返回示例
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
前端用途

启动页面或调试时使用。
如果 ok = true，说明后端和数据加载正常。

4. GET /api/search
用途

统一搜索蛋白和复合物。

支持：

protein
complex
all
请求参数
参数	类型	必填	说明
q	string	是	搜索关键词
type	string	否	protein / complex / all，默认 all
请求示例
GET /api/search?q=TP53&type=protein
GET /api/search?q=EZH2&type=protein
GET /api/search?q=PRC2&type=complex
GET /api/search?q=996&type=complex
返回示例
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
前端用途

用于首页搜索框、自动补全、候选结果列表。

用户点击 protein 结果后跳转：

/protein/{id}

用户点击 complex 结果后跳转：

/complex/{id}
5. GET /api/protein/{uniprot_ac}
用途

获取单个蛋白完整详情。

请求示例
GET /api/protein/Q15910
GET /api/protein/P04637
返回核心结构
{
  "id": "Q15910",
  "key": "UniProt:Q15910",
  "type": "protein",
  "label": "EZH2",
  "summary": {
    "uniprotAc": "Q15910",
    "geneSymbol": "EZH2",
    "proteinName": "Histone-lysine N-methyltransferase EZH2",
    "proteinCategory": "EF",
    "ensemblId": "暂无数据",
    "hgncId": "暂无数据",
    "sequenceLength": "746"
  },
  "sections": []
}
sections 说明

sections 里目前包含：

member_complexes
external_complexes
hpa
raw
member_complexes

表示该蛋白作为亚基所属的复合物。

{
  "id": "member_complexes",
  "title": "作为亚基所属复合物",
  "count": 10,
  "items": [
    {
      "id": "996",
      "key": "CORUM:996",
      "label": "Polycomb repressive complex 2/3",
      "nSubunits": "5"
    }
  ]
}
external_complexes

表示该蛋白作为外部伙伴连接的复合物。

hpa

表示 HPA 表达画像字段。

raw

表示原始 TSV 属性。

前端用途

用于蛋白详情页。

6. GET /api/protein/{uniprot_ac}/neighbors
用途

获取单蛋白中心 PPI 邻域网络。

请求参数
参数	类型	必填	说明
limit	number	否	最多返回多少条边，默认 100，最大 300
请求示例
GET /api/protein/Q15910/neighbors?limit=20
GET /api/protein/P04637/neighbors?limit=20
返回核心结构
{
  "center": {
    "id": "UniProt:Q15910",
    "uniprotAc": "Q15910",
    "label": "EZH2",
    "type": "CenterProtein"
  },
  "nodes": [
    {
      "data": {
        "id": "UniProt:Q15910",
        "label": "EZH2",
        "type": "CenterProtein",
        "uniprotAc": "Q15910",
        "proteinName": "Histone-lysine N-methyltransferase EZH2",
        "category": "EF"
      }
    }
  ],
  "edges": [
    {
      "data": {
        "id": "DIRECT_PPI|UniProt:Q15910|UniProt:...",
        "source": "UniProt:Q15910",
        "target": "UniProt:...",
        "type": "DIRECT_PPI",
        "sources": [],
        "methods": [],
        "publications": [],
        "supportingStructures": [],
        "nDdi": "0",
        "nDmi": "0",
        "hasDdi": false,
        "hasDmi": false,
        "ddi": [],
        "dmi": []
      }
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 100,
    "returned": 20,
    "nextOffset": 20
  },
  "stats": {
    "nodeCount": 21,
    "edgeCount": 20
  },
  "truncated": true
}
前端用途

用于单蛋白中心网络图。

前端网络图可以直接使用：

nodes
edges

每条边的：

source
target

都对应 nodes 里的 data.id。

7. GET /api/complex/{complex_id}
用途

获取复合物基本信息。

请求示例
GET /api/complex/996
返回核心结构
{
  "id": "996",
  "key": "CORUM:996",
  "type": "complex",
  "label": "Polycomb repressive complex 2/3",
  "summary": {
    "complexId": "996",
    "name": "Polycomb repressive complex 2/3",
    "organism": "Human",
    "pmid": "...",
    "cellLine": "暂无数据",
    "purificationMethod": "暂无数据",
    "nSubunits": "5",
    "nExtPpiEdges": "92",
    "nExtPartners": "92"
  },
  "sections": []
}
sections 说明
subunits
go
raw
前端用途

用于复合物详情页右侧信息面板。

8. GET /api/complex/{complex_id}/intra
用途

获取复合物内部 PPI 网络。

请求示例
GET /api/complex/996/intra
返回核心结构
{
  "complex": {
    "id": "996",
    "key": "CORUM:996",
    "label": "Polycomb repressive complex 2/3"
  },
  "nodes": [
    {
      "data": {
        "id": "UniProt:Q15910",
        "label": "EZH2",
        "type": "SubunitProtein",
        "uniprotAc": "Q15910",
        "proteinName": "Histone-lysine N-methyltransferase EZH2",
        "category": "EF"
      }
    }
  ],
  "edges": [
    {
      "data": {
        "id": "INTRA_PAIR_CONFIRMED|CORUM:996|UniProt:Q15910|UniProt:...",
        "source": "UniProt:Q15910",
        "target": "UniProt:...",
        "type": "INTRA_PAIR_CONFIRMED",
        "complexId": "996",
        "evidenceInPpiGraph": true,
        "evidenceLabel": "已获直接 PPI 证据确认",
        "sources": [],
        "methods": [],
        "publications": [],
        "supportingStructures": [],
        "sharedComplexCount": "2",
        "ddi": [],
        "dmi": []
      }
    }
  ],
  "stats": {
    "nodeCount": 5,
    "edgeCount": 10,
    "confirmedEdgeCount": 8,
    "coComplexOnlyEdgeCount": 2
  }
}
边类型
INTRA_PAIR_CONFIRMED

表示两个亚基之间有直接 PPI 证据。

CO_COMPLEX_ONLY

表示两个亚基只是共存于同一复合物，暂无直接 PPI 证据。

前端用途

用于复合物内部网络图。

前端可以根据边类型设置样式：

INTRA_PAIR_CONFIRMED: 实线
CO_COMPLEX_ONLY: 虚线 / 灰色
9. GET /api/complex/{complex_id}/ext
用途

获取复合物外部 PPI 网络。

请求参数
参数	类型	必填	说明
limit	number	否	每页返回边数，默认 50，最大 200
offset	number	否	分页偏移，默认 0
请求示例
GET /api/complex/996/ext?limit=20&offset=0
GET /api/complex/996/ext?limit=20&offset=20
返回核心结构
{
  "complex": {
    "id": "996",
    "key": "CORUM:996",
    "label": "Polycomb repressive complex 2/3"
  },
  "nodes": [
    {
      "data": {
        "id": "CORUM:996",
        "label": "Polycomb repressive complex 2/3",
        "type": "Complex",
        "complexId": "996"
      }
    },
    {
      "data": {
        "id": "UniProt:O14929",
        "label": "HAT1",
        "type": "ExternalProtein",
        "uniprotAc": "O14929",
        "proteinName": "Histone acetyltransferase type B catalytic subunit",
        "category": "EF"
      }
    }
  ],
  "edges": [
    {
      "data": {
        "id": "EXT_PPI|CORUM:996|UniProt:O14929",
        "source": "CORUM:996",
        "target": "UniProt:O14929",
        "type": "EXT_PPI_PARTNER",
        "complexName": "Polycomb repressive complex 2/3",
        "extGeneName": "HAT1",
        "mediatingSubunitIds": ["Q15910", "Q09028", "Q16576"],
        "mediatingSubunitGenes": ["EZH2", "RBBP4", "RBBP7"],
        "nMediatingSubunits": "3",
        "isSubunitOfOtherComplex": false,
        "otherComplexIds": [],
        "sources": ["BioGRID"],
        "methods": ["Reconstituted Complex"],
        "publications": ["34564701"],
        "supportingStructures": []
      }
    }
  ],
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
前端用途

用于复合物外部网络图。

注意：

外部网络必须分页加载
不要一次性请求全部外部边

前端可以根据：

isSubunitOfOtherComplex

突出显示那些本身也是其他复合物亚基的外部蛋白。

10. 前端节点格式约定

所有网络接口都返回：

{
  "nodes": [
    {
      "data": {
        "id": "...",
        "label": "...",
        "type": "..."
      }
    }
  ],
  "edges": [
    {
      "data": {
        "id": "...",
        "source": "...",
        "target": "...",
        "type": "..."
      }
    }
  ]
}

这个格式可以直接给 Cytoscape.js 使用。

11. 前端建议路由
/
搜索首页

/protein/:uniprotAc
蛋白详情页

/protein/:uniprotAc/network
单蛋白邻域网络页

/complex/:complexId
复合物详情页

/complex/:complexId/intra
复合物内部网络页

/complex/:complexId/ext
复合物外部网络页
12. 当前测试样例
TP53 = P04637
EZH2 = Q15910
PRC2/3 = CORUM:996

建议前端开发时优先用：

/api/search?q=EZH2&type=protein
/api/protein/Q15910
/api/protein/Q15910/neighbors?limit=20
/api/complex/996
/api/complex/996/intra
/api/complex/996/ext?limit=20&offset=0

---

## 3. 保存并提交

保存后运行：

```bash
cd ~/Documents/protein-network-v0
git add docs/api_contract.md
git commit -m "Add API contract documentation"
