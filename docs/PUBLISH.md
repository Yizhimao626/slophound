# 发布清单（PUBLISH）

从当前状态到「GitHub + npm 上线」的完整步骤。按顺序做，每一步都很快。

## 1. 占位符（已替换 ✅）

仓库链接已指向 `github.com/Yizhimao626/slophound`（package.json、README 双语徽章、Action 示例、sarif.js、vscode publisher）。仅剩一处可选：

- [ ] `README.md` "Stay updated" 一节如需邮件订阅，自行接入 Buttondown/listmonk 后加链接（当前默认只引导 Watch Releases）

## 2. 发布到 npm

```bash
npm whoami                    # 没有 npm 账号先去 npmjs.com 注册
npm login
npm publish                   # 首次发布无需 --access，默认 public；prepublishOnly 会先跑测试和自扫描
```

- 包名空闲状态：2026-10-06 复查 `registry.npmjs.org/slophound` 返回 404（未占用）。发布当天再查一次：https://www.npmjs.com/package/slophound
- **强烈建议发布后立即在 npm 账户开启 2FA**，防止包被劫持后向用户推送恶意版本
- 发布后验证：`npx slophound test/fixtures/sloppy-project`

## 3. 创建 GitHub 仓库

本地仓库已就绪（main 分支，历史干净，工作区无未提交内容）。只需在远端建仓库并推送：

```powershell
# 方式 A：安装 GitHub CLI（winget install GitHub.cli）后
gh repo create slophound --public --source=. --push

# 方式 B：网页 github.com/new 建仓库（名为 slophound，不要勾选初始化 README），然后：
git remote add origin https://github.com/Yizhimao626/slophound.git
git push -u origin main
```

上传后检查：

- [ ] CI 工作流跑绿（Actions 页）
- [ ] 仓库 Topics 加上：`ai` `slop` `lint` `code-quality` `cli` `static-analysis` `developer-tools` `vibe-coding`
- [ ] Settings → Social preview：上传一张截图（建议：终端扫描输出的截图）
- [ ] About 栏填写一句话描述 + npm 链接

## 4. 合规终检（发布前过一遍）

- [x] 代码 100% 原创（本次会话从零编写，零第三方依赖，无复制粘贴来源）
- [x] 离线：`src/`、`bin/` 无任何网络调用（已用 grep 验证）
- [x] 无遥测、无密钥、无子进程（已验证）
- [x] MIT 许可证已附带
- [x] LICENSE 版权人已改为 Yizhimao626
- [x] README 已声明与 GitHub/OpenAI/Anthropic 无关联（避免商标暗示）
- [ ] npm 包名发布当天仍然空闲

## 5. 版本迭代约定

- 修 bug：patch（0.1.x）；加规则/语言：minor（0.x.0）；破坏性变更：major
- 每次发版同步更新 `CHANGELOG.md`，GitHub 上打 tag 发 Release（Release 是"订阅更新"的锚点）
