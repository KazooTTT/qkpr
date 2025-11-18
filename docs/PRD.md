# PRD

- #脑洞 快速创建 PR 命令行工具
  - 为什么有这个脑洞
    - 虽然之前用 alias实现了一键创建 pr，自动生成 pr 的描述内容，自动打开 pr 的链接的功能，但是还是需要人手动去输入目标的branch name。不是很方便，所以还是打算改成命令行的形式。
    -

     ```shell

     pr() {
       local remote branch target proto host repo_path url pr_url \
             encoded_source encoded_target pr_message clipboard_cmd \
             merge_branch_name sanitized_branch sanitized_target

       # 检查剪贴板命令
       if command -v pbcopy >/dev/null; then
         clipboard_cmd="pbcopy"
       elif command -v xclip >/dev/null; then
         clipboard_cmd="xclip -selection clipboard"
       elif command -v wl-copy >/dev/null; then
         clipboard_cmd="wl-copy"
       else
         echo "⚠️ 未找到可用的剪贴板命令，PR 描述无法复制"
         clipboard_cmd=""
       fi

       # 获取 Git 信息
       branch=$(git symbolic-ref --quiet --short HEAD ||
                git rev-parse --short HEAD)           || {
         echo "❌ 无法获取当前分支信息"; return 1; }

       remote=$(git config --get remote.origin.url) || {
         echo "❌ 不是 Git 仓库"; return 1; }

       # 输入目标分支
       printf "🧭 请输入目标分支 (default: main): "
       read target
       target=${target:-main}

       # 解析 remote
       case $remote in
         git@*:* )
           host=${remote%%:*}; host=${host#git@}
           repo_path=${remote#*:}; repo_path=${repo_path%.git}
           proto="http" ;;
         ssh://git@* )
           tmp=${remote#ssh://git@}
           host=${tmp%%/*}
           repo_path=${tmp#*/}; repo_path=${repo_path%.git}
           proto="http" ;;
         http://* )
           proto="http"
           tmp=${remote#http://}
           host=${tmp%%/*}
           repo_path=${tmp#*/}; repo_path=${repo_path%.git} ;;
         https://* )
           proto="https"
           tmp=${remote#https://}
           host=${tmp%%/*}
           repo_path=${tmp#*/}; repo_path=${repo_path%.git} ;;
         * )
           echo "❌ 无法识别 remote: $remote"; return 1 ;;
       esac

       url="${proto}://${host}/${repo_path}"

       # 生成 PR 链接
       if [[ $host == *github.com ]]; then
         pr_url="${url}/compare/${target}...${branch}"
       else
         encoded_source=${branch//\//%2F}
         encoded_target=${target//\//%2F}
         pr_url="${url}/merge_requests/new?merge_request%5Bsource_branch%5D=${encoded_source}&merge_request%5Btarget_branch%5D=${encoded_target}"
       fi

       # 生成 PR message（取提交信息）
       pr_message="### 🔧 PR: \`${branch}\` → \`${target}\`\n\n#### 📝 Commit Summary:\n"
       commits=$(git log --pretty=format:"- %s" "${target}..${branch}")
       if [[ -z "$commits" ]]; then
         pr_message+="\n（无差异提交）"
       else
         pr_message+="$commits"
       fi

       echo -e "\n📋 PR 描述已生成：\n"
       echo -e "$pr_message"

       # 复制到剪贴板
       if [[ -n "$clipboard_cmd" ]]; then
         echo -e "$pr_message" | eval "$clipboard_cmd"
         echo "✅ 已复制到剪贴板"
       fi

       # 打开 PR 页面
       echo -e "\n👉 打开 PR 页面：$pr_url"
       if command -v open >/dev/null; then
         open "$pr_url"
       elif command -v xdg-open >/dev/null; then
         xdg-open "$pr_url"
       else
         echo "🔗 请手动打开：$pr_url"
       fi

       # 新增：生成并显示建议的合并冲突解决分支名
       # 将分支名中的斜杠替换为下划线，以适应分支命名规范
       sanitized_branch=$(echo "$branch" | tr '/' '-')
       sanitized_target=$(echo "$target" | tr '/' '-')
       merge_branch_name="merge/${sanitized_branch}-to-${sanitized_target}"
       echo -e "\nℹ️ 建议的合并冲突解决分支名: ${merge_branch_name}"
     }
     ```

  - 要做什么
    - 命令行
      - 支持获取当前目录对应的 git info，然后把 git branch 设置为可以选择的交互
      - 提交 pr 之后，我们有一个{merge_branch_name}，支持首先git checkout 到 target branch, and then create new branch whose name is {merge_branch_name}

- #脑洞 快速创建 git commit msg
  - 为什么有这个脑洞
   - 之前我写 git commit msg 的流程是，在 zshrc 中配置一个`alias gcc='git diff --cached | pbcopy'`
   - 提示词如下：
   -

     ```
     遵循 Angular Commit Message 规范，生成git commit message,

     如果用户没有指示，默认为中文
     尽量使用plaintext的语法，不要使用md的语法
     生成的内容中不能包含emoji
     格式：
     <type>(<scope>): <subject>

     <body> <footer>
     其中 subject 必填，body 和 footer 可选

     type:
     [
     'feat', // 新功能
     'fix', // 修复
     'docs', // 文档变更
     'style', // 代码格式
     'refactor', // 重构
     'perf', // 性能优化
     'test', // 增加测试
     'chore', // 构建过程或辅助工具的变动
     'revert', // 回退
     'build', // 打包
     ],

     scope: 可选，表示影响范围（如模块名）
     subject: 简明扼要的提交说明
     body: 详细描述，可多行
     footer: 通常用于关联 Issue 或破坏性变更说明

     示例：
     feat(auth): 添加微信登录功能

     支持微信扫码登录
     支持微信账号绑定
     添加微信用户信息同步
     除了commit msg，其他不需要返回任何内容。
     body中的子项的数量应该限制在5个以内

     请你根据 git diff 生成分支名

     feat/ 新功能开发 feat/user-authentication
     fix/ Bug修复 fix/login-error
     hotfix/ 紧急线上问题修复 hotfix/payment-failure
     refactor/ 代码重构 refactor/user-service
     docs/ 文档更新 docs/api-reference
     perf/ 性能优化 perf/image-loading
     test/ 测试相关 test/user-profile
     chore/ 构建/配置变更 chore/webpack-update
     ```

  - 要做什么
   - 在[[脑洞/把之前写的 pr 的命令行转化为交互更为友好的 vscode 插件]]的插件中，新增一个命令用于实现以上功能。目前仅支持配置 gemini api key，使用 gemini 的 model 实现 Gemini 2.0 Flash。
