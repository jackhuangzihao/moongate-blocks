# Security policy / 安全说明

## Reporting a vulnerability

Please report suspected security vulnerabilities privately through [GitHub's Report a vulnerability form](https://github.com/jackhuangzihao/moongate-blocks/security/advisories/new). If you cannot use that form, email [JackHuangZihao@gmail.com](mailto:JackHuangZihao@gmail.com), the public project contact listed in `LICENSE`.

Include the affected commit or demo URL, whether it occurs in WeChat or the browser, reproduction steps, and the possible impact. Use redacted examples; do not include real credentials, private user data or WeChat friends' information.

Ordinary gameplay bugs and feature suggestions can be reported in [Issues](https://github.com/jackhuangzihao/moongate-blocks/issues). Please keep exploitable security details private while they are assessed and fixed.

## Scope and handling

Security fixes focus on the current `main` branch and its published browser demo. Historical releases and experimental copies are not maintained separately. Reports are reviewed and reproduced before a fix is planned; no fixed response or repair time is promised.

The WeChat **AppID** in `project.config.json` identifies the project and is intended to be public. It is not the AppSecret or an access token. AppSecrets, tokens and private keys must not be committed to this repository or embedded in the public demo.

## 中文说明

- 安全问题请通过上方 GitHub 私下报告入口反馈；无法使用时，联系许可证中公开的项目邮箱。
- 请说明受影响的提交或试玩网址、微信或浏览器环境、复现步骤及可能影响；示例需脱敏，不附真实凭据、用户数据或微信好友资料。
- 普通玩法问题可以提 Issue；可被利用的安全细节先私下沟通。
- 目前优先维护 `main` 分支及对应在线试玩，确认问题后安排修复，不承诺固定响应或修复时限。
- 微信 AppID 是公开项目标识；AppSecret、访问令牌和私钥需要保密，不应进入仓库或公开试玩。
