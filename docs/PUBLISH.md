# 发布清单（PUBLISH）

从当前状态到「GitHub + npm 上线」的完整步骤。按顺序做，每一步都很快。

## 1. 替换占位符

以下文件里的 `your-username` / 作者信息需要替换成你的真实信息：

- [ ] `package.json` → `repository.url`、`bugs.url`
- [ ] `README.md` / `README.zh-CN.md` → CI badge 链接、`uses: your-username/slophound@main`、"Stay updated" 一节的订阅链接
- [ ] `LICENSE` → 把 `The SlopHound Authors` 改成你的名字或 GitHub handle（保留 2026 或改为你的发布年份）
- [ ] `action.yml` 无需改动

```bash
# 在项目根目录全局替换（替换成你的 GitHub 用户名后执行）
grep -rl "your-username" . --exclude-dir=node_modules | xargs sed -i 's/your-username/YOUR_GITHUB_NAME/g'
```

## 2. 发布到 npm

```bash
npm whoami                    # 没有 npm 账号先去 npmjs.com 注册
npm login
npm publish                   # 首次发布无需 --access，默认 public
```

- 发布前再确认一次 `slophound` 未被占用：https://www.npmjs.com/package/slophound （本清单编写时确认过是空闲的，但发布当天再查一次）
- **强烈建议发布后立即在 npm 账户开启 2FA**，防止包被劫持后向用户推送恶意版本
- 发布后验证：`npx slophound test/fixtures/sloppy-project`

## 3. 创建 GitHub 仓库

```bash
cd slophound
git init
git add -A
git commit -m "feat: slophound v0.1.0 — AI slop scanner with fix mode"
gh repo create slophound --public --source=. --push
# 没有 gh CLI 就在网页上建仓库，然后：
# git remote add origin git@github.com:YOUR/slophound.git && git push -u origin main
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
- [ ] LICENSE 版权人已改成你的名字
- [ ] npm 包名发布当天仍然空闲
- [ ] README 已声明与 GitHub/OpenAI/Anthropic 无关联（避免商标暗示）

## 5. 版本迭代约定

- 修 bug：patch（0.1.x）；加规则/语言：minor（0.x.0）；破坏性变更：major
- 每次发版同步更新 `CHANGELOG.md`，GitHub 上打 tag 发 Release（Release 是"订阅更新"的锚点）
