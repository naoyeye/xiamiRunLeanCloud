
## xiamiRun 

这是一个运行在 leancloud 上的应用，用来根据虾米音乐详情页 url 来获取虾米 mp3 音乐地址。

demo:

https://xiamirun.leanapp.cn/



```bash
git clone git@github.com:naoyeye/xiamiRunLeanCloud.git
cd xiamiRunLeanCloud
yarn

# 去 leancloud 创建应用

lean switch # 关联你刚刚创建的应用
lean up # 本地启动
# 访问 http://localhost:3080/?song=http://www.xiami.com/song/1773110382

lean deploy # 部署到预备环境
lean publish # 部署到到生产环境
```


----
通用版：
xiamiRun: https://github.com/naoyeye/xiamiRun