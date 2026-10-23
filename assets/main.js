/* Atria Cloud · comportamento da página
   Tudo aqui roda no navegador: o S3 só entrega os arquivos. */
(() => {
  "use strict";

  document.documentElement.classList.remove("no-js");

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* sem storage, tudo bem */ } },
  };

  /* ------------------------------------------------------------------ */
  /* Regiões e endpoints do S3                                           */
  /* ------------------------------------------------------------------ */

  const REGION_NAMES = {
    "sa-east-1": "São Paulo",
    "us-east-1": "Norte da Virgínia",
    "us-east-2": "Ohio",
    "us-west-1": "Norte da Califórnia",
    "us-west-2": "Oregon",
    "ca-central-1": "Canadá",
    "eu-west-1": "Irlanda",
    "eu-west-2": "Londres",
    "eu-west-3": "Paris",
    "eu-central-1": "Frankfurt",
    "eu-north-1": "Estocolmo",
    "ap-southeast-1": "Singapura",
    "ap-southeast-2": "Sydney",
    "ap-northeast-1": "Tóquio",
    "ap-south-1": "Mumbai",
  };

  // Regiões mais antigas usam "s3-website-REGIAO"; as mais novas, "s3-website.REGIAO".
  const DASH_REGIONS = new Set([
    "us-east-1", "us-west-1", "us-west-2", "ap-southeast-1", "ap-southeast-2",
    "ap-northeast-1", "eu-west-1", "sa-east-1", "us-gov-west-1",
  ]);

  const websiteEndpoint = (bucket, region) =>
    `http://${bucket}.s3-website${DASH_REGIONS.has(region) ? "-" : "."}${region}.amazonaws.com`;

  const regionLabel = (region) =>
    region ? `${region} · ${REGION_NAMES[region] || "AWS"}` : "—";

  function detectHost() {
    const { protocol, hostname, pathname } = window.location;
    let m;

    if (protocol === "file:") return { kind: "file" };
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(hostname) || hostname.endsWith(".local")) {
      return { kind: "local-server" };
    }
    if ((m = hostname.match(/^(.+)\.s3-website[.-]([a-z0-9-]+)\.amazonaws\.com$/))) {
      return { kind: "s3-website", bucket: m[1], region: m[2] };
    }
    if ((m = hostname.match(/^(.+)\.s3(?:[.-]([a-z0-9-]+))?\.amazonaws\.com$/))) {
      return { kind: "s3-rest", bucket: m[1], region: m[2] || null };
    }
    if ((m = hostname.match(/^s3(?:[.-]([a-z0-9-]+))?\.amazonaws\.com$/))) {
      return { kind: "s3-rest", bucket: pathname.split("/")[1] || null, region: m[1] || null };
    }
    if (hostname.endsWith(".cloudfront.net")) return { kind: "cloudfront" };
    return { kind: "custom" };
  }

  const host = detectHost();
  const isLive = !["file", "local-server"].includes(host.kind);

  /* ------------------------------------------------------------------ */
  /* Card de status do deploy                                            */
  /* ------------------------------------------------------------------ */

  const STATUS = {
    "s3-website": {
      title: "Você está no ar!",
      sub: () => `Servido direto de um bucket S3 em ${REGION_NAMES[host.region] || host.region}.`,
      tip: () => window.location.protocol === "http:"
        ? "<strong>Viu o “Não seguro” na barra de endereço?</strong> O website endpoint do S3 só fala HTTP. Pra ter HTTPS e cache no mundo todo, o próximo passo é colocar um <strong>CloudFront</strong> na frente."
        : null,
    },
    "s3-rest": {
      title: "No ar pelo S3!",
      sub: () => "Você abriu o objeto pelo endpoint REST do bucket.",
      tip: () => "Use o <strong>website endpoint</strong> (passo 6) para ter <code>index.html</code> e página de erro automáticos.",
    },
    cloudfront: {
      title: "No ar com CloudFront!",
      sub: () => "S3 + CDN + HTTPS. Próximo nível desbloqueado.",
      tip: () => null,
    },
    custom: {
      title: "Você está no ar!",
      sub: () => `Servido em ${window.location.hostname}.`,
      tip: () => null,
    },
    file: {
      title: "Rodando localmente",
      sub: () => "Você abriu o arquivo direto do disco. Este site ainda não está na nuvem.",
      tip: () => "Siga o <a href=\"#passos\"><strong>passo a passo</strong></a> e veja este card mudar para <strong>“Você está no ar!”</strong>",
    },
    "local-server": {
      title: "Rodando localmente",
      sub: () => `Servidor local em ${window.location.host}. Quase lá!`,
      tip: () => "Siga o <a href=\"#passos\"><strong>passo a passo</strong></a> e veja este card mudar para <strong>“Você está no ar!”</strong>",
    },
  };

  function formatDate(date) {
    try {
      return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
    } catch {
      return date.toLocaleString();
    }
  }

  function renderStatus() {
    const status = STATUS[host.kind];
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

    set("deploy-title", status.title);
    set("deploy-sub", status.sub());

    const tip = $("#deploy-tip");
    const tipHtml = status.tip();
    if (tip && tipHtml) { tip.innerHTML = tipHtml; tip.hidden = false; }

    const icon = $("#deploy-icon");
    if (icon) icon.classList.toggle("is-live", isLive);
    const badge = $("#live-badge");
    if (badge) { badge.textContent = isLive ? "● ao vivo" : "local"; badge.classList.toggle("is-live", isLive); }

    const pill = $("#nav-status");
    if (pill) pill.dataset.state = isLive ? "live" : "local";
    set("nav-status-label", isLive ? "no ar" : "local");

    const protocol = window.location.protocol.replace(":", "").toUpperCase();
    set("kv-host", window.location.host || "arquivo no disco");
    set("kv-bucket", host.bucket || "—");
    set("kv-region", regionLabel(host.region));
    set("kv-proto", protocol === "HTTPS" ? "HTTPS (seguro)" : protocol);
    // No S3, o header Last-Modified é o horário do upload do index.html.
    set("kv-modified", formatDate(new Date(document.lastModified)));
    set("footer-host", window.location.host || "arquivo local");
    set("year", String(new Date().getFullYear()));

    const showLoadTime = () => {
      const nav = performance.getEntriesByType?.("navigation")?.[0];
      const ms = nav && nav.loadEventEnd > 0 ? nav.loadEventEnd : performance.now();
      set("kv-load", `${Math.round(ms)} ms`);
    };
    if (document.readyState === "complete") setTimeout(showLoadTime, 0);
    else window.addEventListener("load", () => setTimeout(showLoadTime, 0), { once: true });
  }

  /* ------------------------------------------------------------------ */
  /* Céu estrelado                                                       */
  /* ------------------------------------------------------------------ */

  function startSky() {
    const canvas = $("#sky");
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, stars = [], shooting = null, nextShot = 2500;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((w * h) / 2600);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() ** 3 * 1.5 + 0.3,
        a: Math.random() * 0.55 + 0.25,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.0025 + 0.0006,
        depth: Math.random() * 0.6 + 0.1,
        warm: Math.random() < 0.08,
      }));
      if (reduceMotion) draw(0);
    }

    function draw(time) {
      ctx.clearRect(0, 0, w, h);
      const scroll = reduceMotion ? 0 : window.scrollY;

      for (const s of stars) {
        const twinkle = reduceMotion ? 1 : 0.6 + 0.4 * Math.sin(s.phase + time * s.speed);
        let y = (s.y - scroll * s.depth * 0.12) % h;
        if (y < 0) y += h;
        ctx.globalAlpha = s.a * twinkle;
        ctx.fillStyle = s.warm ? "#ffd7a8" : "#ebe6ff";
        ctx.beginPath();
        ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.r > 1.25) {
          ctx.globalAlpha = s.a * twinkle * 0.15;
          ctx.beginPath();
          ctx.arc(s.x, y, s.r * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!reduceMotion) drawShootingStar(time);
      ctx.globalAlpha = 1;
    }

    function drawShootingStar(time) {
      if (!shooting && time > nextShot) {
        shooting = {
          x: Math.random() * w * 0.7 + w * 0.3,
          y: Math.random() * h * 0.35,
          start: time,
          life: 900 + Math.random() * 500,
          len: 120 + Math.random() * 120,
        };
      }
      if (!shooting) return;
      const t = (time - shooting.start) / shooting.life;
      if (t >= 1) {
        shooting = null;
        nextShot = time + 4000 + Math.random() * 6000;
        return;
      }
      const dist = t * 420;
      const hx = shooting.x - dist;
      const hy = shooting.y + dist * 0.45;
      const tx = hx + shooting.len;
      const ty = hy - shooting.len * 0.45;
      const grad = ctx.createLinearGradient(hx, hy, tx, ty);
      grad.addColorStop(0, "rgba(255,255,255,0.95)");
      grad.addColorStop(1, "rgba(175,164,236,0)");
      ctx.globalAlpha = Math.sin(t * Math.PI);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }

    resize();
    window.addEventListener("resize", resize);
    if (!reduceMotion) {
      const loop = (time) => { draw(time); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Copiar para a área de transferência                                 */
  /* ------------------------------------------------------------------ */

  // O website endpoint do S3 é HTTP, onde navigator.clipboard não existe;
  // por isso o fallback com textarea + execCommand.
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true; } catch { /* tenta o fallback */ }
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    area.remove();
    return ok;
  }

  function flashCopied(button, ok) {
    const label = $("span", button);
    const original = label ? label.textContent : "";
    button.classList.add("is-copied");
    if (label) label.textContent = ok ? "Copiado!" : "Selecione e copie";
    setTimeout(() => {
      button.classList.remove("is-copied");
      if (label) label.textContent = original;
    }, 1800);
  }

  function setupCopyButtons() {
    $$("[data-copy]").forEach((button) => {
      button.addEventListener("click", async () => {
        const source = document.getElementById(button.dataset.copy);
        if (!source) return;
        flashCopied(button, await copyText(source.textContent.trim()));
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Configuração do bucket (usuário IAM + sufixo + região)              */
  /* ------------------------------------------------------------------ */

  // A IAM policy dos participantes só libera buckets "lab-${aws:username}-*",
  // então o nome do bucket é montado a partir do usuário IAM.
  const DEFAULT_USER = "seu-usuario";
  const DEFAULT_SUFFIX = "site";
  const bucketName = (user, suffix) => `lab-${user}-${suffix}`;
  const config = {
    user: DEFAULT_USER,
    bucket: bucketName(DEFAULT_USER, DEFAULT_SUFFIX),
    region: "sa-east-1",
  };
  const listeners = [];

  function validateBucket(name) {
    if (name.length > 63) return `O nome ficou com ${name.length} caracteres; o limite do S3 é 63. Encurte o sufixo.`;
    if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(name)) return "Nome de bucket inválido: use só minúsculas, números, pontos e hífens.";
    if (name.includes("..")) return "O nome não pode ter dois pontos seguidos.";
    return null;
  }

  // O usuário não é convertido para minúsculas: ${aws:username} diferencia
  // maiúsculas, e mudar o texto faria o nome deixar de bater com a policy.
  function validateUser(user) {
    if (/[A-Z]/.test(user)) return "Seu usuário IAM tem letras maiúsculas, mas nome de bucket só aceita minúsculas. Peça ao instrutor um usuário em minúsculas.";
    if (!/^[a-z0-9.-]*$/.test(user)) return "Esse usuário tem caracteres que não cabem num nome de bucket (como _, @ ou +). Fale com o instrutor.";
    return null;
  }

  function validateSuffix(suffix) {
    if (!/^[a-z0-9.-]*$/.test(suffix)) return "O sufixo aceita só minúsculas, números, pontos e hífens.";
    if (suffix && !/[a-z0-9]$/.test(suffix)) return "O sufixo precisa terminar com letra ou número.";
    return null;
  }

  // "lab-thom-site" -> { user: "thom", suffix: "site" }. Se o usuário salvo
  // bater com o começo do nome, ele resolve usuários que têm hífen.
  function splitLabBucket(bucket, knownUser) {
    if (!bucket || !bucket.startsWith("lab-")) return null;
    const rest = bucket.slice(4);
    if (knownUser && rest.startsWith(`${knownUser}-`)) {
      return { user: knownUser, suffix: rest.slice(knownUser.length + 1) };
    }
    const dash = rest.indexOf("-");
    return dash > 0 ? { user: rest.slice(0, dash), suffix: rest.slice(dash + 1) } : null;
  }

  function applyConfig() {
    $$(".js-bucket").forEach((el) => { el.textContent = config.bucket; });
    $$(".js-user").forEach((el) => { el.textContent = config.user; });
    $$(".js-region").forEach((el) => { el.textContent = config.region; });
    const endpoint = $("#endpoint-url");
    if (endpoint) endpoint.textContent = websiteEndpoint(config.bucket, config.region);
    listeners.forEach((fn) => fn());
  }

  function setupConfig() {
    const userInput = $("#user-input");
    const suffixInput = $("#suffix-input");
    const select = $("#region-input");
    const msg = $("#config-msg");
    if (!userInput || !suffixInput || !select) return;

    const setMessage = (state, text) => {
      if (!msg) return;
      msg.dataset.state = state;
      msg.textContent = text;
    };

    // Se a página já está num bucket "lab-...", ele vira o valor inicial.
    const savedUser = storage.get("atria-cloud:user");
    const fromHost = host.kind.startsWith("s3") ? splitLabBucket(host.bucket, savedUser) : null;
    const initial = fromHost || { user: savedUser, suffix: storage.get("atria-cloud:suffix") };
    const savedRegion = (host.kind.startsWith("s3") && host.region) || storage.get("atria-cloud:region");

    if (initial.user && !validateUser(initial.user)) userInput.value = initial.user;
    if (initial.suffix && !validateSuffix(initial.suffix)) suffixInput.value = initial.suffix;
    if (savedRegion && !$(`option[value="${CSS.escape(savedRegion)}"]`, select)) {
      select.add(new Option(regionLabel(savedRegion), savedRegion));
    }
    if (savedRegion) { select.value = savedRegion; config.region = savedRegion; }

    function update() {
      const cleanedSuffix = suffixInput.value.toLowerCase().replace(/[\s_]+/g, "-");
      if (cleanedSuffix !== suffixInput.value) suffixInput.value = cleanedSuffix;
      const user = userInput.value.trim();
      const suffix = cleanedSuffix;

      const userError = validateUser(user);
      const suffixError = validateSuffix(suffix);
      const bucket = bucketName(user || DEFAULT_USER, suffix || DEFAULT_SUFFIX);
      const error = userError || suffixError || validateBucket(bucket);

      userInput.classList.toggle("is-invalid", Boolean(userError));
      suffixInput.classList.toggle("is-invalid", Boolean(suffixError || (!userError && error)));

      // Com erro, os comandos continuam com o último nome válido.
      if (error) { setMessage("error", error); return; }

      config.user = user || DEFAULT_USER;
      config.bucket = bucket;
      storage.set("atria-cloud:user", user);
      storage.set("atria-cloud:suffix", suffix);

      if (!user) setMessage("neutral", "Digite o usuário IAM que você recebeu pro workshop.");
      else setMessage("ok", `✓ Dentro da sua permissão: lab-${user}-*`);
      applyConfig();
    }

    userInput.addEventListener("input", update);
    suffixInput.addEventListener("input", update);
    select.addEventListener("change", () => {
      config.region = select.value;
      storage.set("atria-cloud:region", select.value);
      applyConfig();
    });

    update();
  }

  /* ------------------------------------------------------------------ */
  /* Terminal animado                                                    */
  /* ------------------------------------------------------------------ */

  const SITE_FILES = [
    "index.html", "error.html", "assets/styles.css", "assets/main.js",
    "assets/favicon.svg", "assets/clouds-back.svg", "assets/clouds-front.svg",
    "assets/atria-logo-branco.webp",
  ];

  function terminalScript() {
    const { bucket: b, region: r } = config;
    const url = websiteEndpoint(b, r);
    return [
      ["comment", "# 0. confere quem você é (o nome do bucket depende disso)"],
      ["cmd", "aws sts get-caller-identity --query Arn --output text"],
      ["out", `arn:aws:iam::123456789012:user/${config.user}`],
      ["comment", "# 1. cria o bucket"],
      ["cmd", `aws s3 mb s3://${b} --region ${r}`],
      ["out", `make_bucket: ${b}`],
      ["comment", "# 2. libera o acesso público"],
      ["cmd", `aws s3api put-public-access-block --bucket ${b} --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"`],
      ["comment", "# 3. aplica a bucket policy (troca o nome no JSON na hora)"],
      ["cmd", `aws s3api put-bucket-policy --bucket ${b} --policy "$(sed 's/NOME-DO-BUCKET/${b}/' bucket-policy.json)"`],
      ["comment", "# 4. ativa o static website hosting"],
      ["cmd", `aws s3 website s3://${b} --index-document index.html --error-document error.html`],
      ["comment", "# 5. envia só os arquivos do site"],
      ["cmd", `aws s3 sync . s3://${b} --exclude "*" --include "*.html" --include "assets/*"`],
      ...SITE_FILES.map((f) => ["ok", `upload: ./${f} to s3://${b}/${f}`]),
      ["comment", "# 6. pronto!"],
      ["cmd", `curl -sI ${url} | head -1`],
      ["out", "HTTP/1.1 200 OK"],
      ["url", `🚀 no ar em ${url}`],
    ];
  }

  function setupTerminal() {
    const body = $("#term-body");
    if (!body) return;
    let runId = 0;
    let started = false;

    const line = (type) => {
      const el = document.createElement("span");
      el.className = `t-${type}`;
      return el;
    };

    function appendLine(type, text) {
      if (type === "cmd") {
        const prompt = line("prompt");
        prompt.textContent = "❯ ";
        body.append(prompt);
      }
      const el = line(type);
      el.textContent = text;
      body.append(el, "\n");
      return el;
    }

    function renderInstant() {
      runId++;
      body.textContent = "";
      terminalScript().forEach(([type, text]) => appendLine(type, text));
      body.append(cursorEl());
      body.scrollTop = body.scrollHeight;
    }

    function cursorEl() {
      const prompt = line("prompt");
      prompt.textContent = "❯ ";
      const frag = document.createDocumentFragment();
      const cursor = document.createElement("span");
      cursor.className = "cursor";
      frag.append(prompt, cursor);
      return frag;
    }

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function play() {
      const id = ++runId;
      started = true;
      body.textContent = "";
      const cursor = document.createElement("span");
      cursor.className = "cursor";

      for (const [type, text] of terminalScript()) {
        if (id !== runId) return;
        if (type === "cmd") {
          const prompt = line("prompt");
          prompt.textContent = "❯ ";
          const el = line("cmd");
          body.append(prompt, el, cursor);
          // Comandos longos digitam mais rápido para a animação não arrastar.
          const step = Math.max(1, Math.ceil(text.length / 70));
          for (let i = 0; i < text.length; i += step) {
            if (id !== runId) return;
            el.textContent = text.slice(0, i + step);
            body.scrollTop = body.scrollHeight;
            await wait(18);
          }
          cursor.remove();
          body.append("\n");
          await wait(260);
        } else {
          appendLine(type, text);
          body.scrollTop = body.scrollHeight;
          await wait(type === "ok" ? 90 : type === "comment" ? 160 : 220);
        }
      }
      if (id === runId) {
        body.append(cursorEl());
        body.scrollTop = body.scrollHeight;
      }
    }

    // Mudou o bucket/região: re-renderiza sem animação.
    listeners.push(() => { if (started) renderInstant(); });

    $("#term-replay")?.addEventListener("click", () => (reduceMotion ? renderInstant() : play()));
    $("#term-copy")?.addEventListener("click", async (event) => {
      const commands = terminalScript()
        .filter(([type]) => type === "cmd" || type === "comment")
        .map(([, text]) => text)
        .join("\n");
      flashCopied(event.currentTarget, await copyText(commands));
    });

    if (reduceMotion || !("IntersectionObserver" in window)) {
      started = true;
      renderInstant();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        play();
      }
    }, { threshold: 0.35 });
    observer.observe(body);
  }

  /* ------------------------------------------------------------------ */
  /* Detalhes de interface                                               */
  /* ------------------------------------------------------------------ */

  function setupReveal() {
    const items = $$("[data-reveal]");
    // Escalona elementos irmãos (cards, passos) para entrarem em sequência.
    $$(".features, .steps, .hero__copy").forEach((group) => {
      [...group.children].forEach((child, i) => child.style.setProperty("--delay", `${i * 90}ms`));
    });
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    items.forEach((el) => observer.observe(el));
  }

  function setupNav() {
    const nav = $(".nav");
    if (!nav) return;
    const update = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  function setupSpotlight() {
    $$(".feature").forEach((card) => {
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        card.style.setProperty("--my", `${event.clientY - rect.top}px`);
      });
    });
  }

  renderStatus();
  startSky();
  setupReveal();
  setupNav();
  setupSpotlight();
  setupCopyButtons();
  setupConfig();
  setupTerminal();
})();
