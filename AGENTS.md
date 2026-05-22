# Release流程

1. 更新 `manifest.json` 中的 `version` 字段
2. 更新 `main.js` 中插件类的 `version` 常量（如果有）
3. 提交并推送: `git add . && git commit -m "chore: bump version to X.Y.Z" && git push`
4. 运行发布脚本: `bash scripts/release.sh`
   - 脚本会自动读取 manifest.json 的版本号，创建同名 tag（无 v 前缀）并推送
   - GitHub Actions 会自动创建 Release，构建并签名上传 main.js / styles.css / manifest.json
5. 在 https://github.com/maoqingwei/obsidian-version-view/actions 检查 workflow 运行状态
6. Release notes 会在创建后自动生成，可在 GitHub 网页上编辑补充
