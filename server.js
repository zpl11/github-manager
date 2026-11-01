import express from 'express';
import cors from 'cors';
import { execFile, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3366;

app.use(cors());
app.use(express.json());

// Helper to check if gh CLI is installed in PATH
async function checkGhInstalled() {
  try {
    const { stdout } = await execFileAsync('gh', ['--version'], { windowsHide: true });
    return { installed: true, version: stdout.split('\n')[0] };
  } catch {
    return { installed: false, version: null };
  }
}

// Helper to check gh CLI authentication and token scopes
async function checkGhAuth() {
  try {
    const { stdout, stderr } = await execFileAsync('gh', ['auth', 'status'], {
      windowsHide: true,
      encoding: 'utf8'
    });
    const combined = (stdout || '') + '\n' + (stderr || '');
    const loggedIn = combined.includes('Logged in to') || combined.includes('Logged in as') || combined.includes('Active account: true');
    const hasDeleteScope = combined.includes('delete_repo');
    return { loggedIn, hasDeleteScope, raw: combined };
  } catch (err) {
    const combined = (err.stdout || '') + '\n' + (err.stderr || '');
    const loggedIn = combined.includes('Logged in to') || combined.includes('Logged in as') || combined.includes('Active account: true');
    const hasDeleteScope = combined.includes('delete_repo');
    return { loggedIn, hasDeleteScope, raw: combined };
  }
}

// Helper to run gh CLI commands safely
async function runGh(args, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync('gh', args, {
      maxBuffer: 15 * 1024 * 1024,
      windowsHide: true,
      encoding: 'utf8',
      ...options
    });
    return { stdout: (stdout || '').trim(), stderr: (stderr || '').trim() };
  } catch (error) {
    const msg = error.stderr || error.stdout || error.message;
    throw new Error(msg);
  }
}

// 1. Current user status, gh installation & auth scope check
app.get('/api/status', async (req, res) => {
  try {
    // Step 1: Check CLI installation
    const ghCheck = await checkGhInstalled();
    if (!ghCheck.installed) {
      return res.json({
        success: false,
        code: 'GH_NOT_INSTALLED',
        message: '未在系统中检测到 GitHub CLI (gh)，请先安装 GitHub CLI。'
      });
    }

    // Step 2: Check Login & Scope status
    const authStatus = await checkGhAuth();
    if (!authStatus.loggedIn) {
      return res.json({
        success: false,
        code: 'GH_NOT_LOGGED_IN',
        hasDeleteScope: false,
        message: 'GitHub CLI 尚未登录，请在终端运行「gh auth login」完成授权。'
      });
    }

    // Step 3: Fetch profile data from API
    const { stdout } = await runGh(['api', 'user']);
    const user = JSON.parse(stdout);

    res.json({
      success: true,
      hasDeleteScope: authStatus.hasDeleteScope,
      ghVersion: ghCheck.version,
      user: {
        login: user.login,
        name: user.name,
        avatar_url: user.avatar_url,
        bio: user.bio,
        html_url: user.html_url,
        public_repos: user.public_repos,
        total_private_repos: user.total_private_repos,
        created_at: user.created_at
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. List user repositories
app.get('/api/repos', async (req, res) => {
  try {
    const { stdout } = await runGh([
      'api',
      'user/repos?per_page=100&affiliation=owner&sort=pushed&direction=desc'
    ]);
    const rawRepos = JSON.parse(stdout);
    
    const now = new Date();
    const repos = rawRepos.map(r => {
      const createdAt = new Date(r.created_at);
      const pushedAt = new Date(r.pushed_at || r.updated_at);
      const diffDays = Math.floor((now - pushedAt) / (1000 * 60 * 60 * 24));
      
      let activityLevel = 'active'; // 30天内活跃
      let activityText = '近期活跃';
      if (diffDays > 180) {
        activityLevel = 'dormant'; // 超过半年未维护
        activityText = '较久未更新';
      } else if (diffDays > 30) {
        activityLevel = 'moderate'; // 1~6个月
        activityText = '常规维护';
      }

      return {
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        private: r.private,
        description: r.description || '',
        created_at: r.created_at,
        pushed_at: r.pushed_at,
        updated_at: r.updated_at,
        diff_days_last_push: diffDays,
        activity_level: activityLevel,
        activity_text: activityText,
        language: r.language || '未知/杂项',
        size_kb: r.size,
        stars: r.stargazers_count,
        forks: r.forks_count,
        open_issues: r.open_issues_count,
        topics: r.topics || [],
        default_branch: r.default_branch,
        html_url: r.html_url,
        clone_url: r.clone_url,
        ssh_url: r.ssh_url,
        archived: r.archived
      };
    });

    res.json({ success: true, repos, total: repos.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Create repository
app.post('/api/repos', async (req, res) => {
  try {
    const { name, description, isPrivate, addReadme, gitignore, license } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: '仓库名称不能为空' });
    }

    const cleanName = name.trim();
    const args = ['repo', 'create', cleanName];

    if (isPrivate) {
      args.push('--private');
    } else {
      args.push('--public');
    }

    if (description && description.trim()) {
      args.push('--description', description.trim());
    }

    if (addReadme) {
      args.push('--add-readme');
    }

    if (gitignore && gitignore !== 'none') {
      args.push('--gitignore', gitignore);
    }

    if (license && license !== 'none') {
      args.push('--license', license);
    }

    const { stdout, stderr } = await runGh(args);

    // Fetch newly created repo info
    const statusRes = await runGh(['api', 'user']);
    const user = JSON.parse(statusRes.stdout);
    const repoRes = await runGh(['api', `repos/${user.login}/${cleanName}`]);
    const newRepo = JSON.parse(repoRes.stdout);

    res.json({
      success: true,
      message: `仓库 ${cleanName} 创建成功！`,
      repo: newRepo,
      output: stdout || stderr
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Delete repository (with scope error detection)
app.delete('/api/repos/:owner/:repo', async (req, res) => {
  const { owner, repo } = req.params;
  const fullName = `${owner}/${repo}`;
  try {
    const { stdout, stderr } = await runGh(['repo', 'delete', fullName, '--yes']);
    res.json({
      success: true,
      message: `仓库 ${fullName} 已成功删除。`,
      output: stdout || stderr
    });
  } catch (err) {
    const errText = err.message || '';
    if (errText.includes('delete_repo') || errText.includes('HTTP 403') || errText.includes('scope')) {
      return res.status(403).json({
        success: false,
        code: 'MISSING_DELETE_SCOPE',
        error: '您的 GitHub 登录令牌缺少「delete_repo」删除权限，请在终端执行：gh auth refresh -s delete_repo 开启权限后重试。'
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Get repository README content
app.get('/api/repos/:owner/:repo/readme', async (req, res) => {
  const { owner, repo } = req.params;
  try {
    const { stdout } = await runGh([
      'api',
      `repos/${owner}/${repo}/readme`,
      '-H',
      'Accept: application/vnd.github.raw'
    ]);
    res.json({ success: true, content: stdout });
  } catch (err) {
    res.json({ success: false, content: null, message: '未找到 README 文件' });
  }
});

// 6. Get repository root files/directories structure
app.get('/api/repos/:owner/:repo/contents', async (req, res) => {
  const { owner, repo } = req.params;
  try {
    const { stdout } = await runGh([
      'api',
      `repos/${owner}/${repo}/contents`
    ]);
    const items = JSON.parse(stdout);
    const list = items.map(item => ({
      name: item.name,
      path: item.path,
      type: item.type,
      size: item.size,
      download_url: item.download_url,
      html_url: item.html_url
    }));
    list.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'dir' ? -1 : 1;
    });
    res.json({ success: true, contents: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Get recent commits
app.get('/api/repos/:owner/:repo/commits', async (req, res) => {
  const { owner, repo } = req.params;
  try {
    const { stdout } = await runGh([
      'api',
      `repos/${owner}/${repo}/commits?per_page=10`
    ]);
    const commits = JSON.parse(stdout).map(c => ({
      sha: c.sha.substring(0, 7),
      message: c.commit.message,
      author: c.commit.author.name,
      date: c.commit.author.date,
      html_url: c.html_url
    }));
    res.json({ success: true, commits });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve frontend build if dist exists
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Dynamic Port Listening with automatic fallback
function startServer(port, maxAttempts = 10) {
  const server = app.listen(port, '127.0.0.1');

  server.on('listening', () => {
    console.log(`========================================================`);
    console.log(`  🚀 GitHub 仓库桌面管理器已启动！`);
    console.log(`  🔗 本地访问地址: http://127.0.0.1:${port}`);
    console.log(`  💡 提示: 保持本窗口开启即可使用，关闭窗口即退出。`);
    console.log(`========================================================\n`);

    // Cross-platform browser launcher
    const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${startCmd} http://127.0.0.1:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (maxAttempts > 0) {
        console.warn(`[端口提示] 端口 ${port} 已被占用，正在尝试 ${port + 1}...`);
        startServer(port + 1, maxAttempts - 1);
      } else {
        console.error(`[致命错误] 未能找到可用端口，服务启动失败。`);
        process.exit(1);
      }
    } else {
      console.error('[服务错误]', err);
    }
  });
}

startServer(DEFAULT_PORT);
