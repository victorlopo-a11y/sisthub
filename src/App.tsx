import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Settings,
  X,
  Link as LinkIcon,
  ArrowRight,
  Palette,
  Check,
  LogIn,
  LogOut,
  Cloud,
  CloudOff,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SystemLink, DEFAULT_CATEGORIES, THEMES, ThemeId } from './types';
import { supabase, supabaseConfigured, supabaseConfigError } from './lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

// Initial demo data
const DEMO_LINKS: SystemLink[] = [
  {
    id: '1',
    name: 'Dashboard Administrativo',
    url: 'https://admin.example.com',
    category: 'work',
    user_id: 'demo',
    description: 'Gestão principal da empresa e KPIs',
    created_at: Date.now(),
  },
  {
    id: '2',
    name: 'Webmail Corporativo',
    url: 'https://mail.google.com',
    category: 'work',
    user_id: 'demo',
    description: 'Acesso rápido ao e-mail interno',
    created_at: Date.now(),
  },
  {
    id: '3',
    name: 'Repositório GitHub',
    url: 'https://github.com',
    category: 'tools',
    user_id: 'demo',
    description: 'Controle de versão e CI/CD',
    created_at: Date.now(),
  }
];

export default function App() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [links, setLinks] = useState<SystemLink[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [currentThemeId, setCurrentThemeId] = useState<ThemeId>('bento-dark');
  const [isSyncing, setIsSyncing] = useState(false);
  const [appView, setAppView] = useState<'login' | 'dashboard'>('login');
  const [brokenBgByLinkId, setBrokenBgByLinkId] = useState<Record<string, true>>({});
  
  // Auth Form
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  // New link form state
  const [newLink, setNewLink] = useState({
    name: '',
    url: '',
    category: 'work',
    description: '',
    bgImage: ''
  });

  const getAutoPreviewUrl = (url: string): string | null => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return `https://image.thum.io/get/width/1200/${parsed.toString()}`;
    } catch {
      return null;
    }
  };

  const getBgOverridesKey = (userId: string) => `sisthub_bg_overrides_${userId}`;

  const loadBgOverrides = (userId: string): Record<string, string> => {
    const raw = localStorage.getItem(getBgOverridesKey(userId));
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') return parsed as Record<string, string>;
      return {};
    } catch {
      return {};
    }
  };

  const saveBgOverride = (userId: string, linkId: string, bgImage: string) => {
    const overrides = loadBgOverrides(userId);
    overrides[linkId] = bgImage;
    localStorage.setItem(getBgOverridesKey(userId), JSON.stringify(overrides));
  };

  const deleteBgOverride = (userId: string, linkId: string) => {
    const overrides = loadBgOverrides(userId);
    if (!overrides[linkId]) return;
    delete overrides[linkId];
    localStorage.setItem(getBgOverridesKey(userId), JSON.stringify(overrides));
  };

  const normalizeGuestLinks = (raw: unknown): SystemLink[] => {
    if (!Array.isArray(raw)) return DEMO_LINKS;
    return raw
      .map((item): SystemLink | null => {
        if (!item || typeof item !== 'object') return null;
        const obj = item as Record<string, unknown>;
        const id = typeof obj.id === 'string' ? obj.id : null;
        const name = typeof obj.name === 'string' ? obj.name : null;
        const url = typeof obj.url === 'string' ? obj.url : null;
        const category = typeof obj.category === 'string' ? obj.category : null;
        if (!id || !name || !url || !category) return null;

        const description = typeof obj.description === 'string' ? obj.description : undefined;
        const bg_image =
          typeof obj.bg_image === 'string'
            ? obj.bg_image
            : (typeof obj.bgImage === 'string' ? obj.bgImage : undefined);
        const user_id =
          typeof obj.user_id === 'string'
            ? obj.user_id
            : (typeof obj.userId === 'string' ? obj.userId : 'guest');
        const created_at =
          typeof obj.created_at === 'number'
            ? obj.created_at
            : (typeof obj.createdAt === 'number' ? obj.createdAt : Date.now());

        return { id, name, url, category, description, bg_image, user_id, created_at };
      })
      .filter((v): v is SystemLink => Boolean(v));
  };

  // Auth Listener
  useEffect(() => {
    if (!supabaseConfigured) {
      setUser(null);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) setAppView('dashboard');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) setAppView('dashboard');
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check if guest mode was chosen before
  useEffect(() => {
    const isGuest = localStorage.getItem('sisthub_guest_mode');
    if (isGuest === 'true' && !user) {
      setAppView('dashboard');
    }
  }, [user]);

  // Fetch Links
  useEffect(() => {
    const fetchLinks = async () => {
      if (!user) {
        const savedLinks = localStorage.getItem('sistemia_links');
        if (savedLinks) {
          try {
            setLinks(normalizeGuestLinks(JSON.parse(savedLinks)));
          } catch (e) {
            setLinks(DEMO_LINKS);
          }
        } else {
          setLinks(DEMO_LINKS);
        }
        return;
      }

      setIsSyncing(true);
      const { data, error } = await supabase
        .from('links')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching links:', error);
      } else {
        const fetched = (data || []) as SystemLink[];
        const overrides = loadBgOverrides(user.id);
        const merged = fetched.map(link => {
          const bgImage = overrides[link.id];
          return bgImage && !link.bg_image ? ({ ...link, bg_image: bgImage } as SystemLink) : link;
        });
        setLinks(merged);
      }
      setIsSyncing(false);
    };

    fetchLinks();
  }, [user]);

  // Save to local storage for guest
  useEffect(() => {
    if (!user && links.length > 0) {
      localStorage.setItem('sistemia_links', JSON.stringify(links));
    }
  }, [links, user]);

  // Load Theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('sistemia_theme') as ThemeId;
    if (savedTheme && THEMES.some(t => t.id === savedTheme)) {
      setCurrentThemeId(savedTheme);
    }
  }, []);

  // Apply theme class
  useEffect(() => {
    localStorage.setItem('sistemia_theme', currentThemeId);
    const root = document.documentElement;
    THEMES.forEach(t => {
      root.classList.remove(`theme-${t.id}`);
      document.body.classList.remove(`theme-${t.id}`);
    });
    if (currentThemeId !== 'bento-dark') {
      root.classList.add(`theme-${currentThemeId}`);
      document.body.classList.add(`theme-${currentThemeId}`);
    }
  }, [currentThemeId]);

  const filteredLinks = useMemo(() => {
    return links.filter(link => {
      const matchesSearch = link.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           link.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           link.url.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'all' || link.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [links, searchQuery, activeCategory]);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.name || !newLink.url) return;

    const bgImage = newLink.bgImage.trim();

    const linkPayload: any = {
      name: newLink.name,
      url: newLink.url,
      category: newLink.category,
      description: newLink.description,
      user_id: user?.id || 'guest',
      created_at: Date.now(),
    };

    if (bgImage) linkPayload.bg_image = bgImage;

    if (user) {
      setIsSyncing(true);

      const { data, error } = await supabase.from('links').insert([linkPayload]).select();

      if (error) {
        console.error('Error saving link:', error);
      } else if (data) {
        const inserted = { ...(data[0] as SystemLink) };
        if (bgImage && !inserted.bg_image) saveBgOverride(user.id, inserted.id, bgImage);
        setLinks(prev => [inserted, ...prev]);
      }
      setIsSyncing(false);
    } else {
      const guestLink: SystemLink = {
        ...(linkPayload as Omit<SystemLink, 'id'>),
        id: Math.random().toString(36).substring(2, 9),
      };
      setLinks(prev => [guestLink, ...prev]);
    }

    setIsModalOpen(false);
    setNewLink({ name: '', url: '', category: 'work', description: '', bgImage: '' });
  };

  const handleDeleteLink = async (id: string) => {
    if (user) {
      setIsSyncing(true);
      const { error } = await supabase
        .from('links')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting link:', error);
      } else {
        setLinks(prev => prev.filter(l => l.id !== id));
        deleteBgOverride(user.id, id);
      }
      setIsSyncing(false);
    } else {
      setLinks(prev => prev.filter(l => l.id !== id));
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');
    setIsSyncing(true);

    if (!supabaseConfigured) {
      setAuthError(supabaseConfigError || 'Supabase não configurado.');
      setIsSyncing(false);
      return;
    }

    try {
      const { data, error } = authMode === 'login'
        ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
        : await supabase.auth.signUp({
            email: authEmail,
            password: authPassword,
            options: { emailRedirectTo: window.location.origin },
          });

      if (error) {
        setAuthError(error.message);
      } else {
        setAuthEmail('');
        setAuthPassword('');
        if (authMode === 'signup' && !data.session) {
          setAuthMessage('Conta criada. Se a confirmação por e-mail estiver ativada, verifique sua caixa de entrada.');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAuthError(message || 'Erro ao comunicar com o servidor de autenticação.');
    }
    setIsSyncing(false);
  };

  const handleLogout = async () => {
    supabase.auth.signOut();
    setAppView('login');
    localStorage.removeItem('sisthub_guest_mode');
    setLinks(DEMO_LINKS);
  };

  const handleContinueAsGuest = () => {
    localStorage.setItem('sisthub_guest_mode', 'true');
    setAppView('dashboard');
  };

  if (appView === 'login') {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 font-sans relative overflow-hidden">
        {/* Decorative Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />

        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Left Side: Editorial Content */}
          <div className="hidden lg:flex flex-col text-white">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-8"
            >
              <div className="w-16 h-16 bg-brand-primary rounded-[2rem] flex items-center justify-center text-white mb-8 shadow-2xl shadow-brand-primary/20">
                <span className="text-3xl">✦</span>
              </div>
              <h1 className="text-[7rem] font-bold leading-[0.85] tracking-tighter mb-8 uppercase">
                Sist<br/>Hub.
              </h1>
              <p className="text-xl text-brand-muted max-w-sm font-medium leading-relaxed">
                Seu portal centralizado para organizar aplicações corporativas com máxima eficiência visual.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex gap-12 mt-12 pt-12 border-t border-brand-border/30"
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-2 font-mono">Status</span>
                <span className="text-sm font-bold flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Sistemas Online
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-2 font-mono">Região</span>
                <span className="text-sm font-bold">BR-SUL-1</span>
              </div>
            </motion.div>
          </div>

          {/* Right Side: Login Form (Bento Style) */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center lg:justify-end"
          >
            <div className="w-full max-w-md bg-brand-surface border border-brand-border rounded-[3rem] p-10 lg:p-12 shadow-2xl relative overflow-hidden">
              {/* Login/Signup Toggle */}
              <div className="flex bg-brand-bg/50 p-1 rounded-2xl mb-10 border border-brand-border/50">
                <button 
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${authMode === 'login' ? 'bg-brand-primary text-white shadow-lg' : 'text-brand-muted hover:text-white'}`}
                >
                  Entrar
                </button>
                <button 
                  onClick={() => setAuthMode('signup')}
                  className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${authMode === 'signup' ? 'bg-brand-primary text-white shadow-lg' : 'text-brand-muted hover:text-white'}`}
                >
                  Criar Conta
                </button>
              </div>

              <div className="text-center mb-10 text-white">
                <h2 className="text-2xl font-bold tracking-tight">
                  {authMode === 'login' ? 'Bem-vindo de volta' : 'Comece sua jornada'}
                </h2>
                <p className="text-brand-muted text-sm mt-2">Acesse sua dashboard sincronizada.</p>
              </div>

              <form onSubmit={handleAuth} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-brand-muted uppercase tracking-widest ml-1 font-mono">E-mail</label>
                  <input 
                    required 
                    type="email" 
                    value={authEmail} 
                    onChange={e => setAuthEmail(e.target.value)} 
                    className="w-full px-6 py-4 border border-brand-border rounded-2xl bg-brand-bg text-white focus:border-brand-primary outline-none transition-colors" 
                    placeholder="voce@empresa.com" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-brand-muted uppercase tracking-widest ml-1 font-mono">Senha</label>
                  <input 
                    required 
                    type="password" 
                    value={authPassword} 
                    onChange={e => setAuthPassword(e.target.value)} 
                    className="w-full px-6 py-4 border border-brand-border rounded-2xl bg-brand-bg text-white focus:border-brand-primary outline-none transition-colors" 
                    placeholder="••••••••" 
                  />
                </div>
                
                {authMessage && <p className="text-xs text-green-500 font-bold bg-green-500/10 p-3 rounded-xl border border-green-500/20">{authMessage}</p>}
                {authError && <p className="text-xs text-red-500 font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20">{authError}</p>}
                
                <button 
                  type="submit" 
                  disabled={isSyncing}
                  className="w-full py-5 bg-white text-black font-extrabold rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-white/5"
                >
                  {isSyncing ? (
                    <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      {authMode === 'login' ? <><LogIn size={20} /> Entrar no Sistema</> : <><User size={20} /> Registrar Novo Acesso</>}
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 flex flex-col items-center gap-4">
                <div className="flex items-center gap-4 w-full">
                  <div className="h-[1px] flex-1 bg-brand-border/50" />
                  <span className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">ou</span>
                  <div className="h-[1px] flex-1 bg-brand-border/50" />
                </div>
                
                <button 
                  onClick={handleContinueAsGuest}
                  className="text-xs font-bold text-brand-muted hover:text-brand-primary transition-colors flex items-center gap-2 group"
                >
                  Continuar sem Sincronização
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-brand-bg text-brand-ink overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-72 border-r border-brand-border flex flex-col bg-brand-surface">
        <div className="p-8">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center text-white">
              <span className="text-xl">✦</span>
            </div>
            SISTHUB
          </h1>
          <div className="mt-4 flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2 bg-green-500/10 text-green-500 px-2 py-1 rounded-md text-[10px] font-bold">
                <Cloud size={12} /> NUVEM ATIVA
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-brand-muted/10 text-brand-muted px-2 py-1 rounded-md text-[10px] font-bold">
                <CloudOff size={12} /> MODO LOCAL
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 px-6 space-y-1.5 overflow-y-auto">
          <div className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.15em] mb-4 mt-2 px-2">Categorias</div>
          {DEFAULT_CATEGORIES.map(category => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                activeCategory === category.id 
                ? 'bg-brand-border text-white shadow-lg' 
                : 'text-brand-muted hover:bg-brand-border/50 hover:text-white'
              }`}
            >
              <span>{category.label}</span>
              {activeCategory === category.id && (
                <motion.div layoutId="activeCat" className="w-1.5 h-1.5 rounded-full bg-brand-primary shadow-[0_0_8px_white]" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-brand-border mt-auto space-y-3">
          {user ? (
            <div className="bg-brand-bg/50 rounded-xl p-4 border border-brand-border">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary">
                  <User size={16} />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[10px] font-bold text-brand-muted truncate uppercase tracking-tighter">Sincronizado</span>
                  <span className="text-xs font-bold text-white truncate">{user.email}</span>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 text-brand-muted hover:text-white text-xs font-bold transition-colors py-2"
              >
                <LogOut size={14} /> Sair da Nuvem
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setAppView('login')}
              className="w-full flex items-center justify-center gap-2 border border-brand-border text-white py-3 rounded-xl font-bold hover:bg-brand-border/50 transition-all text-sm mb-2"
            >
              <LogIn size={18} /> Entrar na Nuvem
            </button>
          )}

          <div className="flex gap-6 font-mono text-[10px] text-brand-muted px-2 py-1">
            <div><strong className="text-white">{links.length}</strong> ATIVOS</div>
            <div>{isSyncing ? <span className="animate-pulse text-brand-primary">SINCRONIZANDO...</span> : <span>ESTÁVEL</span>}</div>
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white py-3.5 rounded-xl font-bold hover:brightness-110 shadow-lg shadow-brand-primary/20 transition-all active:scale-[0.98]"
          >
            <Plus size={18} />
            Novo Sistema
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-24 border-b border-brand-border bg-brand-bg/50 backdrop-blur-md flex items-center justify-between px-10 z-10 text-white">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Launcher Centralizado</h1>
            <p className="text-brand-muted text-sm font-medium">Onde você quer ir hoje?</p>
          </div>
          
          <div className="relative w-full max-w-md mx-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" size={18} />
            <input 
              type="text" 
              placeholder="Buscar aplicação ou ferramenta..."
              className="w-full pl-12 pr-6 py-3 bg-brand-surface border border-brand-border rounded-xl focus:outline-none focus:border-brand-primary transition-all text-white placeholder:text-brand-muted/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsThemeModalOpen(true)}
              className="p-3 rounded-xl border border-brand-border bg-brand-surface hover:border-brand-primary transition-all text-brand-muted hover:text-brand-primary"
              title="Mudar Tema"
            >
              <Palette size={20} />
            </button>
            <button className="p-3 rounded-xl border border-brand-border bg-brand-surface hover:border-brand-muted/50 transition-all">
              <Settings size={20} className="text-brand-muted" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-10">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 auto-rows-[minmax(180px,auto)] gap-4">
              <AnimatePresence mode="popLayout">
                {filteredLinks.map((link, index) => {
                  const isLarge = index === 0 && searchQuery === '' && activeCategory === 'all';
                  const isWide = (index === 1 || index === 5) && searchQuery === '';
                  const isTall = (index === 2) && searchQuery === '';
                  const bgSrc =
                    brokenBgByLinkId[link.id]
                      ? null
                      : (link.bg_image?.trim() || getAutoPreviewUrl(link.url));
                  
                  return (
                    <motion.div
                      key={link.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`group flex flex-col justify-between p-8 border rounded-[20px] transition-all duration-300 relative overflow-hidden ${
                         isLarge 
                          ? 'md:col-span-2 md:row-span-2 bg-gradient-to-br from-[#1e1b4b] to-brand-surface border-[#312e81] hover:border-brand-primary' 
                          : isWide 
                          ? 'lg:col-span-2 bg-brand-surface border-brand-border hover:border-brand-primary'
                          : isTall
                          ? 'lg:row-span-2 bg-brand-surface border-brand-border hover:border-brand-primary'
                          : 'bg-brand-surface border-brand-border hover:border-brand-primary'
                      }`}
                    >
                      {bgSrc && (
                        <img
                          src={bgSrc}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity duration-300 pointer-events-none"
                          onError={() => setBrokenBgByLinkId(prev => ({ ...prev, [link.id]: true }))}
                        />
                      )}
                      {bgSrc && <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/0 via-black/40 to-black/80" />}

                      <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10">
                        <button 
                           onClick={() => handleDeleteLink(link.id)}
                           className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors border border-red-500/10"
                           title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="relative z-10 flex flex-col h-full text-white">
                        <div className="flex items-start justify-between mb-6">
                          <div className={`rounded-xl flex items-center justify-center transition-all duration-500 ${
                            isLarge ? 'w-16 h-16 bg-brand-primary text-white' : 'w-12 h-12 bg-brand-border text-brand-muted'
                          }`}>
                            <LinkIcon size={isLarge ? 32 : 24} />
                          </div>
                          {isLarge && <span className="status-badge status-online whitespace-nowrap">Ativo • v1.2</span>}
                        </div>
                        
                        <div className="flex-1">
                          <h3 className={`${isLarge ? 'text-3xl' : 'text-lg'} font-bold mb-2 tracking-tight line-clamp-2`}>{link.name}</h3>
                          <p className={`text-brand-muted leading-relaxed font-medium ${isLarge ? 'text-base mb-6' : 'text-xs line-clamp-3'}`}>
                            {link.description || 'Sistema integrado ao seu painel central.'}
                          </p>
                          
                          {isTall && (
                            <div className="mt-6 p-4 bg-brand-bg/40 rounded-xl text-[10px] border border-brand-border/50 text-brand-muted">
                              [ LOG: Conexão Estável ]
                            </div>
                          )}
                        </div>

                        <div className="mt-8 pt-4 border-t border-brand-border/30 flex items-center justify-between">
                          <a 
                            href={link.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 font-bold text-xs transition-all duration-300 ${
                              isLarge ? 'text-brand-primary hover:text-white' : 'text-brand-muted hover:text-white'
                            }`}
                          >
                            Acessar Sistema
                            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                          </a>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              <motion.button 
                layout
                onClick={() => setIsModalOpen(true)}
                className="flex flex-col items-center justify-center p-8 border border-dashed border-brand-border rounded-[20px] hover:border-brand-primary hover:bg-brand-surface/50 transition-all group min-h-[180px]"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-border flex items-center justify-center mb-4 group-hover:bg-brand-primary group-hover:text-white transition-all duration-500">
                  <Plus size={24} />
                </div>
                <h4 className="text-sm font-bold text-brand-muted group-hover:text-white">Novo Atalho</h4>
              </motion.button>
            </div>

            {filteredLinks.length === 0 && (
              <div className="py-32 text-center text-white">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-brand-surface mb-6 text-brand-muted">
                  <Search size={40} />
                </div>
                <h3 className="text-2xl font-bold">Nenhum resultado</h3>
                <p className="text-brand-muted mt-2 font-medium">Refine sua busca por "{searchQuery}"</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }} className="relative w-full max-w-xl bg-brand-surface rounded-[2.5rem] shadow-2xl border border-brand-border overflow-hidden">
               <div className="px-10 py-8 border-b border-brand-border flex items-center justify-between text-white bg-brand-surface">
                <h3 className="text-2xl font-extrabold tracking-tight">Novo Atalho Cloud</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-brand-border/50"><X size={20} /></button>
              </div>
              <form onSubmit={handleAddLink} className="p-10 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">Nome</label>
                    <input required className="w-full px-5 py-4 border border-brand-border rounded-xl bg-brand-bg text-white focus:border-brand-primary outline-none" value={newLink.name} onChange={e => setNewLink(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">Categoria</label>
                    <select className="w-full px-5 py-4 border border-brand-border rounded-xl bg-brand-bg text-white focus:border-brand-primary outline-none appearance-none cursor-pointer" value={newLink.category} onChange={e => setNewLink(p => ({ ...p, category: e.target.value }))}>
                      {DEFAULT_CATEGORIES.filter(c => c.id !== 'all').map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">URL</label>
                  <input required type="url" className="w-full px-5 py-4 border border-brand-border rounded-xl bg-brand-bg text-brand-primary font-mono text-sm" value={newLink.url} onChange={e => setNewLink(p => ({ ...p, url: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">Imagem de Fundo (URL)</label>
                  <input type="url" className="w-full px-5 py-4 border border-brand-border rounded-xl bg-brand-bg text-white focus:border-brand-primary outline-none" value={newLink.bgImage} onChange={e => setNewLink(p => ({ ...p, bgImage: e.target.value }))} placeholder="(opcional) deixe vazio para usar a prévia automática do site" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">Descrição</label>
                  <textarea rows={3} className="w-full px-5 py-4 border border-brand-border rounded-xl bg-brand-bg text-white resize-none" value={newLink.description} onChange={e => setNewLink(p => ({ ...p, description: e.target.value }))} />
                </div>
                <button type="submit" className="w-full py-5 bg-brand-primary text-white font-extrabold rounded-2xl hover:brightness-110 shadow-lg shadow-brand-primary/20 transition-all">Salvar no Hub</button>
              </form>
            </motion.div>
          </div>
        )}

        {isThemeModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsThemeModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }} className="relative w-full max-w-md bg-brand-surface rounded-[2.5rem] shadow-2xl border border-brand-border overflow-hidden p-10">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-extrabold text-white">Interface</h3>
                <button onClick={() => setIsThemeModalOpen(false)} className="p-2 text-brand-muted hover:text-white"><X size={20} /></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {THEMES.map(theme => (
                  <button key={theme.id} onClick={() => setCurrentThemeId(theme.id)} className={`flex flex-col items-center gap-3 p-6 rounded-3xl border-2 transition-all ${currentThemeId === theme.id ? 'border-brand-primary bg-brand-primary/10 text-white' : 'border-brand-border bg-brand-bg text-brand-muted hover:border-brand-muted'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${theme.isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                      {currentThemeId === theme.id && <Check size={16} className="text-brand-primary" />}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{theme.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
