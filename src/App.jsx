import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderGit2,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  Trash2,
  BookOpen,
  Copy,
  Check,
  Calendar,
  Clock,
  Code2,
  Lock,
  Globe,
  AlertTriangle,
  X,
  FileText,
  Folder,
  GitCommit,
  Sparkles,
  Layers,
  Terminal,
  ShieldAlert,
  Info
} from 'lucide-react';
import { marked } from 'marked';

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: true
});

// Color mapping for popular programming languages
const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  Shell: '#89e051',
  Vue: '#41b883',
  PHP: '#4F5D95'
};

function formatDate(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return d.toISOString().split('T')[0];
}

function timeAgo(isoStr) {
  if (!isoStr) return '';
  const now = new Date();
  const past = new Date(isoStr);
  const diffSec = Math.floor((now - past) / 1000);
  
  if (diffSec < 60) return '刚刚';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} 天前`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} 个月前`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} 年前`;
}

function formatSize(kb) {
  if (!kb || kb === 0) return '0 KB';
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [hasDeleteScope, setHasDeleteScope] = useState(true);
  const [envError, setEnvError] = useState(null); // { code, message }
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('all'); // all, public, private
  const [activityFilter, setActivityFilter] = useState('all'); // all, active, moderate, dormant
  const [sortBy, setSortBy] = useState('pushed'); // pushed, created, name, size

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    isPrivate: false,
    addReadme: true,
    gitignore: 'none',
    license: 'none'
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Delete modal state
  const [repoToDelete, setRepoToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [scopeHelpModal, setScopeHelpModal] = useState(false);

  // Detail / Inspector drawer
  const [activeRepo, setActiveRepo] = useState(null);
  const [activeTab, setActiveTab] = useState('readme'); // readme, contents, commits
  const [readmeContent, setReadmeContent] = useState('');
  const [contentsList, setContentsList] = useState([]);
  const [commitsList, setCommitsList] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Copied state
  const [copiedId, setCopiedId] = useState(null);
  const [copiedCmd, setCopiedCmd] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const copyToClipboard = (text, label = '命令') => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    showToast(`已复制${label}: ${text}`);
    setTimeout(() => setCopiedCmd(''), 2500);
  };

  // Fetch user profile and repos
  const fetchData = async () => {
    try {
      setRefreshing(true);
      const userRes = await fetch('/api/status').then(r => r.json());

      if (!userRes.success) {
        setEnvError({ code: userRes.code, message: userRes.message });
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setEnvError(null);
      setUser(userRes.user);
      setHasDeleteScope(userRes.hasDeleteScope);

      const reposRes = await fetch('/api/repos').then(r => r.json());
      if (reposRes.success) {
        setRepos(reposRes.repos);
      } else {
        showToast(reposRes.error || '获取仓库列表失败', 'error');
      }
    } catch (err) {
      showToast('获取 GitHub 数据失败：' + err.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter and sort repos
  const filteredRepos = useMemo(() => {
    return repos
      .filter(repo => {
        // Search
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchName = repo.name.toLowerCase().includes(q);
          const matchDesc = repo.description.toLowerCase().includes(q);
          const matchLang = (repo.language || '').toLowerCase().includes(q);
          const matchTopic = repo.topics.some(t => t.toLowerCase().includes(q));
          if (!matchName && !matchDesc && !matchLang && !matchTopic) return false;
        }

        // Visibility
        if (visibilityFilter === 'public' && repo.private) return false;
        if (visibilityFilter === 'private' && !repo.private) return false;

        // Activity
        if (activityFilter === 'active' && repo.activity_level !== 'active') return false;
        if (activityFilter === 'moderate' && repo.activity_level !== 'moderate') return false;
        if (activityFilter === 'dormant' && repo.activity_level !== 'dormant') return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'pushed') {
          return new Date(b.pushed_at || b.updated_at) - new Date(a.pushed_at || a.updated_at);
        }
        if (sortBy === 'created') {
          return new Date(b.created_at) - new Date(a.created_at);
        }
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'size') {
          return b.size_kb - a.size_kb;
        }
        return 0;
      });
  }, [repos, search, visibilityFilter, activityFilter, sortBy]);

  // Overall Stats
  const stats = useMemo(() => {
    const total = repos.length;
    const pub = repos.filter(r => !r.private).length;
    const priv = repos.filter(r => r.private).length;
    const active = repos.filter(r => r.activity_level === 'active').length;
    return { total, pub, priv, active };
  }, [repos]);

  // Handle Create Repo
  const handleCreateRepo = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;

    setCreateLoading(true);
    try {
      const res = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '创建仓库失败');
      }

      showToast(`仓库「${createForm.name}」创建成功！`, 'success');
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        description: '',
        isPrivate: false,
        addReadme: true,
        gitignore: 'none',
        license: 'none'
      });
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle Delete Repo
  const handleDeleteRepo = async () => {
    if (!repoToDelete) return;
    setDeleteLoading(true);
    try {
      const [owner, name] = repoToDelete.full_name.split('/');
      const res = await fetch(`/api/repos/${owner}/${name}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        if (data.code === 'MISSING_DELETE_SCOPE') {
          setScopeHelpModal(true);
          return;
        }
        throw new Error(data.error || '删除仓库失败');
      }

      showToast(`仓库「${repoToDelete.name}」已成功删除！`, 'success');
      if (activeRepo && activeRepo.id === repoToDelete.id) {
        setActiveRepo(null);
      }
      setRepoToDelete(null);
      setDeleteConfirmText('');
      setRepos(prev => prev.filter(r => r.id !== repoToDelete.id));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Inspect Repository (README, Files, Commits)
  const handleInspectRepo = async (repo, tab = 'readme') => {
    setActiveRepo(repo);
    setActiveTab(tab);
    setDetailLoading(true);
    const [owner, name] = repo.full_name.split('/');

    try {
      if (tab === 'readme') {
        const res = await fetch(`/api/repos/${owner}/${name}/readme`).then(r => r.json());
        setReadmeContent(res.content || '');
      } else if (tab === 'contents') {
        const res = await fetch(`/api/repos/${owner}/${name}/contents`).then(r => r.json());
        setContentsList(res.contents || []);
      } else if (tab === 'commits') {
        const res = await fetch(`/api/repos/${owner}/${name}/commits`).then(r => r.json());
        setCommitsList(res.commits || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSwitchTab = async (tab) => {
    if (!activeRepo) return;
    handleInspectRepo(activeRepo, tab);
  };

  const handleCopyClone = (repo) => {
    navigator.clipboard.writeText(repo.clone_url);
    setCopiedId(repo.id);
    showToast(`已复制 Clone 链接: ${repo.clone_url}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="container">
      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="brand-section">
          <div className="logo-icon">
            <FolderGit2 size={24} />
          </div>
          <div>
            <h1 className="brand-title">GitHub 仓库管理器</h1>
            <p className="brand-subtitle">极速创建、便捷删除、状态洞察与内容概览</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user && (
            <a
              href={user.html_url}
              target="_blank"
              rel="noreferrer"
              className="user-profile-badge"
              title="访问 GitHub 个人主页"
            >
              <img src={user.avatar_url} alt={user.login} className="user-avatar" />
              <span>{user.name || user.login}</span>
            </a>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchData}
            disabled={refreshing}
            title="刷新仓库数据"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span>刷新</span>
          </button>

          {!envError && (
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={18} />
              <span>新建仓库</span>
            </button>
          )}
        </div>
      </header>

      {/* Scope Warning Banner if delete_repo is missing */}
      {!envError && !hasDeleteScope && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '12px',
          padding: '12px 18px',
          marginBottom: '20px',
          fontSize: '0.875rem',
          color: '#fcd34d'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Info size={18} />
            <span>
              <strong>安全提示：</strong>当前 GitHub 登录令牌未开启 <code>delete_repo</code> 权限。您仍可正常浏览和创建仓库，但如需在此工具中直接删除仓库，请开启该权限。
            </span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fef08a' }}
            onClick={() => copyToClipboard('gh auth refresh -s delete_repo', '授权命令')}
          >
            {copiedCmd === 'gh auth refresh -s delete_repo' ? <Check size={14} /> : <Copy size={14} />}
            <span>复制授权命令</span>
          </button>
        </div>
      )}

      {/* ===================== ONBOARDING / ENVIRONMENT ERROR VIEW ===================== */}
      {envError ? (
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '40px 32px',
          maxWidth: '720px',
          margin: '40px auto',
          textAlign: 'center'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            {envError.code === 'GH_NOT_INSTALLED' ? <Terminal size={32} /> : <Lock size={32} />}
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '10px' }}>
            {envError.code === 'GH_NOT_INSTALLED' ? '未检测到 GitHub CLI (gh)' : 'GitHub CLI 尚未授权登录'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '24px', lineHeight: 1.6 }}>
            {envError.message}
          </p>

          {envError.code === 'GH_NOT_INSTALLED' ? (
            <div style={{ textAlign: 'left', background: '#090d16', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)', marginBottom: '24px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '12px', color: '#94a3b8' }}>
                请根据您的操作系统执行以下命令安装 GitHub CLI：
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.04)', padding: '10px 14px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.85rem' }}>🪟 Windows: <code>winget install --id GitHub.cli</code></span>
                  <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard('winget install --id GitHub.cli')}>
                    <Copy size={13} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.04)', padding: '10px 14px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.85rem' }}>🍎 macOS: <code>brew install gh</code></span>
                  <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard('brew install gh')}>
                    <Copy size={13} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.04)', padding: '10px 14px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.85rem' }}>🐧 Linux: <code>sudo apt install gh</code></span>
                  <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard('sudo apt install gh')}>
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'left', background: '#090d16', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)', marginBottom: '24px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '10px', color: '#94a3b8' }}>
                请打开终端运行以下命令，完成账号授权登录：
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.04)', padding: '10px 14px', borderRadius: '8px' }}>
                <code style={{ color: '#38bdf8' }}>gh auth login</code>
                <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard('gh auth login')}>
                  <Copy size={13} />
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                提示：执行后在终端依次选择「GitHub.com」→「HTTPS」→「Login with a web browser」，在网页点击授权即可完成。
              </p>
            </div>
          )}

          <button className="btn btn-primary" onClick={fetchData} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            <span>我已完成，重新检测</span>
          </button>
        </div>
      ) : (
        <>
          {/* Stats Summary Grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                <Layers size={22} />
              </div>
              <div>
                <div className="stat-val">{stats.total}</div>
                <div className="stat-label">总仓库数量</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                <Globe size={22} />
              </div>
              <div>
                <div className="stat-val">{stats.pub}</div>
                <div className="stat-label">公开仓库 (Public)</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                <Lock size={22} />
              </div>
              <div>
                <div className="stat-val">{stats.priv}</div>
                <div className="stat-label">私有仓库 (Private)</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                <Sparkles size={22} />
              </div>
              <div>
                <div className="stat-val">{stats.active}</div>
                <div className="stat-label">近期活跃 (30天内提交)</div>
              </div>
            </div>
          </div>

          {/* Controls & Filter Bar */}
          <div className="controls-bar">
            {/* Search */}
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="搜索仓库名称、描述、语言或标签..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Filter Pills */}
            <div className="filter-group">
              <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.8)', padding: '3px', borderRadius: '10px' }}>
                <button
                  className={`tab-pill ${visibilityFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setVisibilityFilter('all')}
                >
                  全部
                </button>
                <button
                  className={`tab-pill ${visibilityFilter === 'public' ? 'active' : ''}`}
                  onClick={() => setVisibilityFilter('public')}
                >
                  公开
                </button>
                <button
                  className={`tab-pill ${visibilityFilter === 'private' ? 'active' : ''}`}
                  onClick={() => setVisibilityFilter('private')}
                >
                  私有
                </button>
              </div>

              {/* Activity Filter */}
              <select
                className="select-control"
                value={activityFilter}
                onChange={e => setActivityFilter(e.target.value)}
              >
                <option value="all">所有活跃度</option>
                <option value="active">🟢 近期活跃 (≤30天)</option>
                <option value="moderate">🟡 常规维护 (1~6个月)</option>
                <option value="dormant">⚪ 较久未更新 (超过6个月)</option>
              </select>

              {/* Sort Dropdown */}
              <select
                className="select-control"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
              >
                <option value="pushed">按最近提交维护时间</option>
                <option value="created">按仓库创建时间</option>
                <option value="name">按仓库名称 A-Z</option>
                <option value="size">按仓库体积大小</option>
              </select>
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="empty-state">
              <RefreshCw size={36} className="empty-icon animate-spin" />
              <p>正在读取 GitHub 仓库数据...</p>
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="empty-state">
              <FolderGit2 className="empty-icon" />
              <h3>未找到匹配的仓库</h3>
              <p style={{ marginTop: '8px' }}>您可以调整搜索过滤条件，或者直接新建一个仓库。</p>
              <button
                className="btn btn-primary"
                style={{ marginTop: '16px' }}
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={16} /> 新建仓库
              </button>
            </div>
          ) : (
            /* Repository Cards Grid */
            <div className="repo-grid">
              {filteredRepos.map(repo => {
                const langColor = LANGUAGE_COLORS[repo.language] || '#94a3b8';
                return (
                  <div key={repo.id} className="repo-card">
                    <div className="card-top">
                      <div className="repo-title-row">
                        <a
                          href={repo.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="repo-name"
                          title={repo.full_name}
                        >
                          {repo.name}
                        </a>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className={`badge ${repo.private ? 'badge-private' : 'badge-public'}`}>
                            {repo.private ? <Lock size={11} /> : <Globe size={11} />}
                            {repo.private ? '私有' : '公开'}
                          </span>
                        </div>
                      </div>

                      <p className="repo-description">
                        {repo.description || <span style={{ color: 'var(--text-muted)' }}>暂无项目描述</span>}
                      </p>

                      {/* Meta Stats Panel */}
                      <div className="repo-meta-section">
                        <div className="meta-row">
                          <span className="meta-item">
                            <Calendar size={13} style={{ color: 'var(--primary)' }} />
                            <span>创建时间:</span>
                          </span>
                          <span className="meta-value">
                            {formatDate(repo.created_at)} ({timeAgo(repo.created_at)})
                          </span>
                        </div>

                        <div className="meta-row">
                          <span className="meta-item">
                            <Clock size={13} style={{ color: repo.activity_level === 'active' ? '#10b981' : '#f59e0b' }} />
                            <span>维护频率:</span>
                          </span>
                          <span className="meta-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className={`pulse-dot ${repo.activity_level}`}></span>
                            <span>{timeAgo(repo.pushed_at)}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              ({repo.activity_text})
                            </span>
                          </span>
                        </div>

                        <div className="meta-row">
                          <span className="meta-item">
                            <Code2 size={13} />
                            <span>核心技术:</span>
                          </span>
                          <span className="meta-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="language-dot" style={{ backgroundColor: langColor }}></span>
                            <span>{repo.language}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              · {formatSize(repo.size_kb)}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Topics Tags */}
                      {repo.topics && repo.topics.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                          {repo.topics.map(t => (
                            <span
                              key={t}
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: 'rgba(56, 189, 248, 0.1)',
                                color: '#38bdf8'
                              }}
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Card Actions Bottom */}
                    <div className="card-actions">
                      <div className="actions-left">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleInspectRepo(repo, 'readme')}
                          title="查看 README 与代码文件概况"
                        >
                          <BookOpen size={14} />
                          <span>查看概览</span>
                        </button>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleCopyClone(repo)}
                          title="复制 Clone 链接"
                        >
                          {copiedId === repo.id ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                        </button>

                        <a
                          href={repo.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary btn-sm"
                          title="在 GitHub 网页中打开"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>

                      {/* Delete Button */}
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          setRepoToDelete(repo);
                          setDeleteConfirmText('');
                        }}
                        title="删除此仓库"
                      >
                        <Trash2 size={14} />
                        <span>删除</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===================== CREATE REPO MODAL ===================== */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !createLoading && setShowCreateModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Plus size={22} style={{ color: 'var(--primary)' }} />
                <span>新建 GitHub 仓库</span>
              </h2>
              <button
                className="modal-close-btn"
                onClick={() => !createLoading && setShowCreateModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateRepo}>
              <div className="form-group">
                <label className="form-label">仓库名称 *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="例如: my-awesome-project"
                  value={createForm.name}
                  onChange={e => setCreateForm({ ...createForm, name: e.target.value.replace(/\s+/g, '-') })}
                  autoFocus
                />
                <div className="form-help">建议使用小写字母、数字和中划线 (-)</div>
              </div>

              <div className="form-group">
                <label className="form-label">仓库描述 (可选)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="简要描述项目功能与目的..."
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">可见性设置</label>
                <div className="radio-cards">
                  <div
                    className={`radio-card ${!createForm.isPrivate ? 'active' : ''}`}
                    onClick={() => setCreateForm({ ...createForm, isPrivate: false })}
                  >
                    <Globe size={18} style={{ color: '#34d399', marginTop: '2px' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>公开 (Public)</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>任何人在互联网上都能查看</div>
                    </div>
                  </div>

                  <div
                    className={`radio-card ${createForm.isPrivate ? 'active' : ''}`}
                    onClick={() => setCreateForm({ ...createForm, isPrivate: true })}
                  >
                    <Lock size={18} style={{ color: '#fbbf24', marginTop: '2px' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>私有 (Private)</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>仅自己和被邀请者可见</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={createForm.addReadme}
                    onChange={e => setCreateForm({ ...createForm, addReadme: e.target.checked })}
                    style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                  />
                  <span>自动创建初始化 README.md 文件</span>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">.gitignore 模板</label>
                  <select
                    className="form-select"
                    value={createForm.gitignore}
                    onChange={e => setCreateForm({ ...createForm, gitignore: e.target.value })}
                  >
                    <option value="none">无 (None)</option>
                    <option value="Node">Node</option>
                    <option value="Python">Python</option>
                    <option value="Go">Go</option>
                    <option value="Rust">Rust</option>
                    <option value="Java">Java</option>
                    <option value="C++">C++</option>
                    <option value="Unity">Unity</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">开源许可证</label>
                  <select
                    className="form-select"
                    value={createForm.license}
                    onChange={e => setCreateForm({ ...createForm, license: e.target.value })}
                  >
                    <option value="none">无 (None)</option>
                    <option value="mit">MIT License</option>
                    <option value="apache-2.0">Apache 2.0</option>
                    <option value="gpl-3.0">GNU GPLv3</option>
                    <option value="bsd-3-clause">BSD 3-Clause</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={createLoading}
                  onClick={() => setShowCreateModal(false)}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createLoading || !createForm.name.trim()}
                >
                  {createLoading ? '正在创建中...' : '立即创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== DELETE CONFIRMATION MODAL ===================== */}
      {repoToDelete && (
        <div className="modal-overlay" onClick={() => !deleteLoading && setRepoToDelete(null)}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: '#ef4444' }}>
                <AlertTriangle size={24} />
                <span>确认删除仓库</span>
              </h2>
              <button
                className="modal-close-btn"
                onClick={() => !deleteLoading && setRepoToDelete(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '10px',
                padding: '14px',
                color: '#fca5a5',
                fontSize: '0.875rem',
                lineHeight: 1.5,
                marginBottom: '16px'
              }}>
                <strong>⚠️ 危险操作警示：</strong>
                <p style={{ marginTop: '4px' }}>
                  此操作将永久删除 GitHub 远程仓库 <strong>{repoToDelete.full_name}</strong> 及其所有分支、代码历史、Issues 与 Releases，<strong>无法恢复！</strong>
                </p>
              </div>

              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                为防止误触，请输入仓库名 <strong>{repoToDelete.name}</strong> 确认：
              </p>
              <input
                type="text"
                className="form-input"
                placeholder={repoToDelete.name}
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={deleteLoading}
                onClick={() => setRepoToDelete(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleteLoading || deleteConfirmText.trim() !== repoToDelete.name}
                onClick={handleDeleteRepo}
              >
                {deleteLoading ? '正在删除中...' : '确认永久删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SCOPE HELP MODAL (MISSING DELETE_REPO SCOPE) ===================== */}
      {scopeHelpModal && (
        <div className="modal-overlay" onClick={() => setScopeHelpModal(false)}>
          <div className="modal-card" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: '#f59e0b' }}>
                <ShieldAlert size={24} />
                <span>需要删除权限授权</span>
              </h2>
              <button className="modal-close-btn" onClick={() => setScopeHelpModal(false)}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
              出于安全保护，GitHub CLI 默认登录时未赋予 <code>delete_repo</code> 权限。请在您的电脑终端中执行下方命令，开启删除授权后即可生效：
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#090d16',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '20px'
            }}>
              <code style={{ color: '#38bdf8', fontSize: '0.9rem' }}>gh auth refresh -s delete_repo</code>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => copyToClipboard('gh auth refresh -s delete_repo', '授权命令')}
              >
                {copiedCmd === 'gh auth refresh -s delete_repo' ? <Check size={14} /> : <Copy size={14} />}
                <span>复制命令</span>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-primary" onClick={() => { setScopeHelpModal(false); fetchData(); }}>
                完成授权后点击刷新
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== INSPECTOR DRAWER (README & CODE OUTLINE) ===================== */}
      {activeRepo && (
        <div className="drawer-overlay" onClick={() => setActiveRepo(null)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>
                    {activeRepo.name}
                  </h2>
                  <span className={`badge ${activeRepo.private ? 'badge-private' : 'badge-public'}`}>
                    {activeRepo.private ? '私有' : '公开'}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {activeRepo.description || '暂无描述'}
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveRepo(null)}>
                <X size={22} />
              </button>
            </div>

            {/* Navigation Tabs in Drawer */}
            <div style={{
              display: 'flex',
              gap: '12px',
              padding: '12px 28px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'rgba(15, 23, 42, 0.4)'
            }}>
              <button
                className={`tab-pill ${activeTab === 'readme' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('readme')}
              >
                <BookOpen size={14} style={{ display: 'inline', marginRight: '6px' }} />
                README 概况
              </button>
              <button
                className={`tab-pill ${activeTab === 'contents' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('contents')}
              >
                <Folder size={14} style={{ display: 'inline', marginRight: '6px' }} />
                代码目录树 ({contentsList.length})
              </button>
              <button
                className={`tab-pill ${activeTab === 'commits' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('commits')}
              >
                <GitCommit size={14} style={{ display: 'inline', marginRight: '6px' }} />
                最近提交动态
              </button>
            </div>

            <div className="drawer-body">
              {detailLoading ? (
                <div className="empty-state">
                  <RefreshCw size={28} className="empty-icon animate-spin" />
                  <p>加载仓库内容中...</p>
                </div>
              ) : activeTab === 'readme' ? (
                readmeContent ? (
                  <div
                    className="markdown-body"
                    dangerouslySetInnerHTML={{ __html: marked.parse(readmeContent) }}
                  />
                ) : (
                  <div className="empty-state">
                    <FileText className="empty-icon" />
                    <p>该仓库暂无 README.md 文件</p>
                  </div>
                )
              ) : activeTab === 'contents' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {contentsList.map(item => (
                    <a
                      key={item.path}
                      href={item.html_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        textDecoration: 'none',
                        border: '1px solid var(--border-subtle)',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {item.type === 'dir' ? (
                          <Folder size={16} style={{ color: '#38bdf8' }} />
                        ) : (
                          <FileText size={16} style={{ color: '#94a3b8' }} />
                        )}
                        <span style={{ fontSize: '0.875rem', fontWeight: item.type === 'dir' ? 600 : 400 }}>
                          {item.name}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {item.type === 'file' ? formatSize(Math.ceil(item.size / 1024)) : '文件夹'}
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                /* Commits tab */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {commitsList.map(c => (
                    <div
                      key={c.sha}
                      style={{
                        padding: '12px 16px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {c.sha}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {timeAgo(c.date)} ({formatDate(c.date)})
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                        {c.message}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                        提交者: {c.author}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
