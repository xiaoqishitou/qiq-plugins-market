# qiq 插件市场

qiq 机器人框架的插件仓库：只放**市场清单**与**编译好的插件包**（`.zip`），不含任何源码。

- 市场清单：<https://xiaoqishitou.github.io/qiq-plugins-market/market.json>
- 网页浏览：<https://xiaoqishitou.github.io/qiq-plugins-market/>

## 怎么用

在 qiq 桌面端「设置 → 插件市场」里填上面的清单地址，保存后到「市场」页刷新，即可一键下载安装。

```
https://xiaoqishitou.github.io/qiq-plugins-market/market.json
```

## 目录

| 文件 | 说明 |
| --- | --- |
| `market.json` | 市场清单（插件项里的 `url` 是绝对地址，桌面端不做相对解析） |
| `plugins/*.zip` | 插件包，每个包内含 `plugin.json` 与插件 dll |
| `index.html` | 静态浏览页，零依赖，直接读 `market.json` |

安装时框架会校验清单里的 `sha256`；下载到的包与清单不一致会被丢弃。
