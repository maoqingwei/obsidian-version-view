# Release流程

1. 更新 `manifest.json` 中的 `version` 字段
2. 更新 `main.js` 中插件类的 `version` 常量（如果有）
3. 提交并推送: `git add . && git commit -m "chore: bump version to X.Y.Z" && git push`
4. 运行发布脚本: `bash scripts/release.sh`
   - 脚本会自动读取 manifest.json 的版本号，创建同名 tag（无 v 前缀），推送并创建 GitHub Release，同时上传 main.js / styles.css / manifest.json
5. 若需要编辑 release notes，可在 GitHub 网页上补充
