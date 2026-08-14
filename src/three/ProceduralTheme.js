/**
 * ProceduralTheme.js
 * Universal Job-to-3D Theme Classifier
 * Covers EVERY profession on earth — no job left behind!
 * Supports: English, Arabic, generic/partial terms, misspellings
 */

export const THEMES = {
  code: {
    id: 'code', name: 'Code Matrix', emoji: '💻',
    primaryColor: 0x00ff88, secondaryColor: 0x0088ff, accentColor: 0x00ffcc,
    bgColor: 0x050a10, particleCount: 3000, glowIntensity: 2.0,
    keywords: [
      // Generic
      'developer','programmer','coder','dev','software','it specialist',
      'it support','tech','technical','computer science',
      // Roles
      'frontend','backend','fullstack','full stack','full-stack',
      'web developer','web dev','mobile dev','mobile developer',
      'ios','android','devops','sre','site reliability','cloud engineer',
      'cloud developer','platform engineer','infrastructure engineer',
      'embedded','firmware','systems engineer','blockchain','smart contract',
      'solidity','qa engineer','test engineer','automation engineer',
      'ai engineer','ml engineer','machine learning engineer',
      'game developer','game dev','unity','unreal','unity developer',
      // Languages/techs as job titles
      'javascript','python developer','java developer','react developer',
      'node developer','php developer','ruby developer','go developer',
      'rust developer','swift developer','kotlin developer','flutter developer',
      // Arabic
      'مطور','برمجة','مطور ويب','مطور تطبيقات','مهندس برمجيات','مبرمج',
      'مطور جوال','مطور موبايل','مهندس سحابي','مطور ألعاب','تطوير',
      'مهندس ذكاء اصطناعي','مهندس تعلم آلة','مطور أندرويد','مطور ios',
    ]
  },

  hacker: {
    id: 'hacker', name: 'Cyber Command', emoji: '🛡️',
    primaryColor: 0xff0040, secondaryColor: 0x00ffff, accentColor: 0xff4400,
    bgColor: 0x060010, particleCount: 2500, glowIntensity: 2.5,
    keywords: [
      'security','cyber','hacker','penetration','pentest','pen test',
      'ethical hacker','infosec','ctf','forensics','network security',
      'soc analyst','soc engineer','threat intelligence','malware analyst',
      'reverse engineer','vulnerability','red team','blue team','purple team',
      'cryptographer','cryptography','firewall','incident response',
      'cybersecurity','cyber security','information security','devsecops',
      'cloud security','application security','appsec','network engineer',
      'سيبراني','أمن','أمن معلومات','هاكر','اختراق','شبكات','حماية',
      'أمن سيبراني','أمن الشبكات','محلل أمن','مختبر اختراق',
    ]
  },

  data: {
    id: 'data', name: 'Data Galaxy', emoji: '📊',
    primaryColor: 0xffd700, secondaryColor: 0x7c3aed, accentColor: 0xf59e0b,
    bgColor: 0x08060f, particleCount: 4000, glowIntensity: 1.8,
    keywords: [
      'data scientist','data analyst','data engineer','data architect',
      'machine learning','ml','ai researcher','artificial intelligence',
      'deep learning','nlp','computer vision','business intelligence',
      'bi analyst','bi developer','analytics','statistician','quantitative',
      'quant analyst','research scientist','actuary','actuarial',
      'econometrist','econometrics','big data','hadoop','spark','databricks',
      'tableau','power bi','looker','dbt','etl developer','data warehouse',
      'data modeler','database administrator','dba','sql developer',
      'بيانات','تحليل بيانات','عالم بيانات','ذكاء اصطناعي','تعلم آلة',
      'إحصاء','باحث بيانات','محلل بيانات','مهندس بيانات','قاعدة بيانات',
    ]
  },

  blueprint: {
    id: 'blueprint', name: 'Blueprint CAD', emoji: '🏗️',
    primaryColor: 0x4488ff, secondaryColor: 0x00aaff, accentColor: 0x88ccff,
    bgColor: 0x020810, particleCount: 2000, glowIntensity: 1.5,
    keywords: [
      // ⭐ GENERIC — catches "engineer" and "مهندس" without specialty
      'engineer','engineering','مهندس','هندسة',
      // Architecture
      'architect','architecture','معمار','معماري',
      // Civil & Construction
      'civil','civil engineer','structural','structural engineer',
      'construction','construction manager','site engineer','quantity surveyor',
      'surveyor','geotechnical','geotechnical engineer','urban planner',
      'urban planning','مهندس مدني','إنشائي','مهندس إنشائي','مقاول',
      // Mechanical
      'mechanical','mechanical engineer','hvac','piping engineer',
      'مهندس ميكانيكي','ميكانيكا',
      // Electrical
      'electrical','electrical engineer','مهندس كهربائي','كهربائي',
      // Chemical & Environmental
      'chemical','chemical engineer','environmental engineer','environmental',
      'مهندس كيميائي','مهندس بيئي',
      // Aerospace & Automotive
      'aerospace','aerospace engineer','automotive engineer','aviation engineer',
      'مهندس طيران',
      // Petroleum & Mining
      'petroleum','petroleum engineer','oil and gas','mining engineer','mining',
      'مهندس بترول','بترول',
      // Industrial & Manufacturing
      'industrial','industrial engineer','manufacturing','manufacturing engineer',
      'quality engineer','production engineer','مهندس صناعي','إنتاج',
      // Nuclear & Biomedical
      'nuclear','nuclear engineer','biomedical engineer','biomedical',
      // Materials & Welding
      'materials engineer','materials','metallurgical','welding engineer',
      // AutoCAD etc
      'autocad','revit','solidworks','catia','ansys',
      // Arabic general
      'مهندس معماري','مهندس كهربائي','مهندس ميكانيكي',
      'مهندس نووي','مهندس مناجم','مساح','مخطط عمراني',
    ]
  },

  creative: {
    id: 'creative', name: 'Liquid Prism', emoji: '🎨',
    primaryColor: 0xff6ec7, secondaryColor: 0xa855f7, accentColor: 0xfbbf24,
    bgColor: 0x080510, particleCount: 3500, glowIntensity: 2.2,
    keywords: [
      'designer','ui designer','ux designer','ui/ux','graphic designer',
      'graphic artist','visual designer','brand designer','logo designer',
      'art director','creative director','illustrator','digital artist',
      'motion designer','motion graphics','3d artist','3d modeler',
      '3d animator','animator','vfx artist','vfx','compositor',
      'concept artist','character artist','fashion designer','fashion',
      'interior designer','interior design','product designer',
      'typography','typographer','web designer','print designer',
      'packaging designer','visual artist','fine artist','sculptor',
      'calligrapher','tattoo artist','makeup artist','nail artist',
      'مصمم','مصمم جرافيك','مصمم داخلي','مصمم أزياء','فنان','رسام',
      'مصمم هوية','مصمم مواقع','مخرج فني','مدير إبداعي','خطاط',
      'نحات','مصمم داخلي','ديكور','ديكوراتور','ديكور داخلي',
    ]
  },

  media: {
    id: 'media', name: 'Aperture Cinema', emoji: '📸',
    primaryColor: 0xff8c00, secondaryColor: 0xcc00ff, accentColor: 0xffcc44,
    bgColor: 0x080408, particleCount: 2800, glowIntensity: 2.0,
    keywords: [
      'photographer','videographer','filmmaker','cinematographer','director',
      'film director','documentary filmmaker','video editor','video producer',
      'content creator','youtuber','influencer','podcaster','streamer',
      'social media manager','social media creator','tiktok creator',
      'journalist','reporter','news anchor','tv presenter','broadcaster',
      'radio presenter','radio host','media producer','media manager',
      'pr specialist','public relations','communications','media relations',
      'photographer','photo editor','video director','creative producer',
      'مصور','مصور فوتوغرافي','مصور فيديو','مخرج','صانع محتوى',
      'مذيع','إعلامي','صحفي','يوتيوبر','منتج','مقدم برامج',
      'مدير تواصل اجتماعي','كريتور','مؤثر','بودكاستر',
    ]
  },

  health: {
    id: 'health', name: 'BioSphere DNA', emoji: '🧬',
    primaryColor: 0x00ff99, secondaryColor: 0x00ccff, accentColor: 0x88ffcc,
    bgColor: 0x030a08, particleCount: 2500, glowIntensity: 1.6,
    keywords: [
      'doctor','physician','surgeon','specialist','gp','general practitioner',
      'cardiologist','neurologist','oncologist','dermatologist','radiologist',
      'psychiatrist','psychologist','therapist','counselor','nurse','nursing',
      'midwife','pharmacist','dentist','orthodontist','optometrist','ophthalmologist',
      'physiotherapist','physical therapist','occupational therapist',
      'speech therapist','dietitian','nutritionist','lab technician',
      'medical technician','healthcare','medical','clinical','paramedic',
      'emt','veterinarian','vet','biomedical','biochemist','microbiologist',
      'biologist','geneticist','epidemiologist','public health','healthcare worker',
      'fitness trainer','personal trainer','gym trainer','sports coach',
      'athletic trainer','yoga instructor','pilates instructor',
      'طبيب','دكتور','جراح','ممرض','صيدلي','طبيب أسنان','دكتورة أسنان',
      'معالج فيزيائي','مدرب لياقة','مدرب رياضي','أخصائي تغذية',
      'معالج نفسي','أخصائي نفسي','طبيب بيطري','ممرضة','طبيبة',
    ]
  },

  marketing: {
    id: 'marketing', name: 'Growth Reactor', emoji: '📈',
    primaryColor: 0xff6600, secondaryColor: 0xffcc00, accentColor: 0xff9900,
    bgColor: 0x0a0500, particleCount: 3200, glowIntensity: 2.1,
    keywords: [
      'marketing','marketer','digital marketing','growth hacker','growth',
      'seo specialist','seo','sem','ppc','paid ads','performance marketing',
      'brand manager','brand strategist','product manager','product owner',
      'product marketing','content marketer','content strategist',
      'email marketing','crm','social media marketing','affiliate marketer',
      'sales','salesperson','sales manager','account executive',
      'account manager','business development','bd manager','revenue',
      'demand generation','lead generation','ecommerce','e-commerce',
      'copywriter','advertising','media buyer','media planner',
      'customer success','customer success manager','csm','growth manager',
      'تسويق','مسوق','مسوق رقمي','مدير تسويق','مدير مبيعات',
      'مندوب مبيعات','مدير منتج','كاتب محتوى','إعلانات','مبيعات',
    ]
  },

  finance: {
    id: 'finance', name: 'Golden Markets', emoji: '💰',
    primaryColor: 0xffd700, secondaryColor: 0x22c55e, accentColor: 0xf0a500,
    bgColor: 0x060804, particleCount: 3000, glowIntensity: 1.9,
    keywords: [
      // ⭐ GENERIC — catches "accountant", "محاسب" directly
      'accountant','accounting','محاسب','محاسبة','محاسبة مالية',
      // Finance roles
      'cpa','auditor','مراجع','مراجع حسابات','financial analyst',
      'financial advisor','financial planner','cfp','cfa','finance','banker',
      'investment banker','investment analyst','portfolio manager','fund manager',
      'hedge fund','trader','stock trader','forex trader','quant trader',
      'risk analyst','risk manager','credit analyst','credit officer',
      'loan officer','mortgage broker','insurance agent','underwriter',
      'actuary','tax specialist','tax advisor','tax consultant',
      'budget analyst','controller','cfo','chief financial officer',
      'economist','treasury','treasurer','compliance officer',
      'internal auditor','external auditor','forensic accountant',
      'payroll specialist','bookkeeper','cost accountant',
      'محلل مالي','مستشار مالي','مصرفي','محاسب قانوني','مدقق',
      'محلل استثمار','مدير مالي','محاسب تكاليف','خبير ضرائب',
    ]
  },

  education: {
    id: 'education', name: 'Knowledge Nebula', emoji: '📚',
    primaryColor: 0x8b5cf6, secondaryColor: 0xec4899, accentColor: 0xfbbf24,
    bgColor: 0x06040d, particleCount: 3000, glowIntensity: 1.7,
    keywords: [
      // Teachers & Academics
      'teacher','professor','lecturer','instructor','tutor','educator',
      'school teacher','university professor','academic','dean','principal',
      'school principal','curriculum designer','instructional designer',
      'e-learning','online educator','corporate trainer',
      // Research
      'researcher','scientist','research','phd','postdoc',
      // Translators & Linguists ⭐
      'translator','translation','interpreter','linguist','localization',
      'language specialist','subtitler','proofreader','editor',
      'technical writer','content writer','copyeditor','مترجم','ترجمة',
      'مترجم فوري','لغوي','محرر','كاتب','كاتب محتوى','مدقق لغوي',
      // Coaches & Trainers
      'coach','life coach','mentor','trainer',
      // Arabic Teachers
      'مدرس','أستاذ','مدرب','معلم','مدير مدرسة','باحث','محاضر',
      'أكاديمي','مشرف تعليمي','مرشد','مشرف','موجه','مساعد أكاديمي',
    ]
  },

  legal: {
    id: 'legal', name: 'Justice Grid', emoji: '⚖️',
    primaryColor: 0xc0a060, secondaryColor: 0x6b7280, accentColor: 0xe5c97e,
    bgColor: 0x080706, particleCount: 2200, glowIntensity: 1.5,
    keywords: [
      'lawyer','attorney','solicitor','barrister','advocate','counsel',
      'legal advisor','legal counsel','paralegal','notary','judge',
      'magistrate','prosecutor','public defender','corporate lawyer',
      'litigation','contract lawyer','ip lawyer','intellectual property',
      'patent attorney','patent','trademark','immigration lawyer',
      'real estate lawyer','family lawyer','criminal lawyer','tax lawyer',
      'compliance','regulatory','law','legal','jurist','law clerk',
      'محامي','مستشار قانوني','قاضي','مدعي عام','محامي شركات',
      'محامي جنائي','قانوني','شريعة','مستشار شرعي','فقيه',
    ]
  },

  cosmic: {
    id: 'cosmic', name: 'Cosmic Elite', emoji: '✨',
    primaryColor: 0x8844ff, secondaryColor: 0x4488ff, accentColor: 0xcc88ff,
    bgColor: 0x040408, particleCount: 5000, glowIntensity: 1.8,
    keywords: [] // Catch-all default for any unrecognized profession
  }
};

/**
 * Classify ANY job title to the best matching 3D theme
 * Handles: full titles, partial words, Arabic, English, mixed, misspellings
 */
export function classifyProfession(title = '') {
  const normalized = title.toLowerCase().trim()
    .replace(/\s+/g, ' ')           // normalize spaces
    .replace(/[.,،؛]/g, '');        // remove punctuation

  if (!normalized) return THEMES.cosmic;

  let bestMatch = null;
  let bestScore = 0;

  for (const theme of Object.values(THEMES)) {
    if (theme.id === 'cosmic') continue; // skip default, only use as fallback
    let score = 0;

    for (const keyword of theme.keywords) {
      if (normalized.includes(keyword)) {
        // Longer keyword = more specific match = higher score
        score += keyword.length * 2;

        // Exact match gets big bonus
        if (normalized === keyword) score += 30;
        // Starts with keyword bonus
        else if (normalized.startsWith(keyword)) score += 15;
        // Ends with keyword bonus
        else if (normalized.endsWith(keyword)) score += 10;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = theme;
    }
  }

  // Return best match if score is meaningful, else cosmic default
  return (bestMatch && bestScore >= 4) ? bestMatch : THEMES.cosmic;
}

/**
 * Get theme by ID
 */
export function getThemeById(id) {
  const normalizedId = id === 'cyber' ? 'hacker' : id;
  return THEMES[normalizedId] || THEMES.cosmic;
}

/**
 * All available themes as array
 */
export function getAllThemes() {
  return Object.values(THEMES);
}

/**
 * Quick test helper — for debugging profession detection
 */
export function debugClassify(title) {
  const theme = classifyProfession(title);
  console.log(`"${title}" → ${theme.emoji} ${theme.name} (${theme.id})`);
  return theme;
}
