/* KAI · Membership application — questions (ES/EN). Edit texts here. */
window.KAIAPP_SCHEMA = (function () {
  var Y = [["y", "Sí", "Yes"], ["n", "No", "No"]];
  var YMN = [["y", "Sí", "Yes"], ["m", "Tal vez", "Maybe"], ["n", "No", "No"]];
  var NEED = [["No lo necesito", "Not needed"], ["Lo necesito mucho", "Much needed"]];
  var IMP = [["Poco", "Low"], ["Muy importante", "Very important"]];
  var WELL = [["Muy bien", "Very well"], ["Muy difícil", "Very hard"]];

  var A = [
    { id: "a1", t: ["Tipo de membresía", "Membership type"], h: ["La cuota anual incluye su credencial ministerial y se paga una vez aprobada su aplicación.", "The annual fee includes your ministry credential and is paid once your application is approved."],
      f: [{ k: "tier", type: "tier", req: 1 }] },
    { id: "a2", t: ["Datos personales", "Personal information"], h: ["Su título y su nombre aparecerán en su credencial tal como los escriba aquí.", "Your title and name will appear on your credential exactly as you write them here."],
      f: [
        { type: "cred" },
        { k: "first_name", l: ["Nombre(s)", "First name(s)"], w: 3, req: 1 },
        { k: "last_name", l: ["Apellidos", "Last name(s)"], w: 3, req: 1 },
        { k: "birth", l: ["Fecha de nacimiento", "Date of birth"], w: 3, in: "date" },
        { k: "lang_pref", l: ["Idioma preferido", "Preferred language"], w: 3, type: "radio", o: [["es", "Español", "Español"], ["en", "English", "English"]] },
        { k: "email", l: ["Correo electrónico", "Email"], w: 3, in: "email", req: 1 },
        { k: "phone", l: ["Teléfono", "Phone"], w: 3, in: "tel", req: 1 },
        { k: "address", l: ["Dirección postal · para enviarle su credencial impresa", "Mailing address · to send your printed credential"], w: 6, req: 1 },
        { k: "city", l: ["Ciudad", "City"], w: 2, req: 1 },
        { k: "state", l: ["Estado", "State"], w: 2, req: 1 },
        { k: "zip", l: ["Código postal", "ZIP code"], w: 2, req: 1 }
      ] },
    { id: "a3", t: ["Familia", "Family"],
      f: [
        { k: "marital", l: ["Estado civil", "Marital status"], type: "radio", req: 1, o: [["s", "Soltero(a)", "Single"], ["c", "Casado(a)", "Married"], ["v", "Viudo(a)", "Widowed"], ["d", "Divorciado(a)", "Divorced"]] },
        { k: "spouse_name", l: ["Nombre del cónyuge", "Spouse's name"], w: 3, when: "marital=c" },
        { k: "spouse_serves", l: ["¿Sirve en el ministerio?", "Does your spouse serve in ministry?"], w: 3, type: "radio", o: Y, when: "marital=c" },
        { k: "spouse_cred", l: ["¿Su cónyuge también tendrá credencial de KAI?", "Will your spouse also hold a KAI credential?"], type: "radio", when: "marital=c",
          o: [["y", "Sí, llenará su propia aplicación", "Yes, they will submit their own application"], ["m", "Ya es miembro de KAI", "Already a KAI member"], ["n", "No", "No"]] },
        { k: "spouse_email", l: ["Correo electrónico de su cónyuge", "Spouse's email"], in: "email", when: "spouse_cred=y,m", s: ["Con este correo enlazamos sus dos membresías como matrimonio. Cada uno recibe su propia credencial.", "We use this email to link your two memberships as a married couple. Each of you receives your own credential."] },
        { k: "children", l: ["Hijos", "Children"], opt: 1, ph: ["Nombres y edades. Ej.: Ana 12, David 9", "Names and ages. E.g. Ana 12, David 9"] },
        { k: "dependents", l: ["Otros dependientes a su cargo", "Other dependents in your care"], opt: 1 }
      ] },
    { id: "a4", t: ["Declaración de Fe", "Statement of Faith"],
      f: [
        { k: "faith_ok", type: "faith", req: 1 },
        { k: "faith_diff", l: ["¿Hay algún punto en el que difiera?", "Is there any point on which you differ?"], opt: 1 }
      ] },
    { id: "a5", t: ["Ministerio actual", "Current ministry"],
      f: [
        { k: "leads", l: ["¿Pastorea actualmente una congregación?", "Do you currently lead a congregation?"], type: "radio", req: 1, o: Y },
        { k: "ministry_desc", type: "area", req: 1, when: "leads=n", l: ["Describa su ministerio", "Describe your ministry"],
          desc: [["Por ejemplo: itinerante, evangelismo, capellanía, enseñanza, misiones o en transición. Cuéntenos dónde y con quién sirve actualmente."],
                 ["For example: itinerant, evangelism, chaplaincy, teaching, missions, or in transition. Tell us where and with whom you currently serve."]] },
        { k: "church", l: ["Nombre de la iglesia o ministerio", "Church or ministry name"], w: 3, req: 1 },
        { k: "role", l: ["Su rol", "Your role"], w: 3, type: "select", req: 1, sort: 1, o: [["Founding Pastor", "Pastor(a) Fundador(a)", "Founding Pastor"], ["Apostle", "Apóstol", "Apostle"], ["Assistant Pastor", "Pastor(a) Asistente", "Assistant Pastor"], ["Bishop", "Obispo", "Bishop"], ["Deacon", "Diácono / Diaconisa", "Deacon"], ["Evangelist", "Evangelista", "Evangelist"], ["Missionary", "Misionero(a)", "Missionary"], ["Ordained Minister", "Ministro(a) Ordenado(a)", "Ordained Minister"], ["Pastor", "Pastor(a)", "Pastor"], ["Pastor Emeritus", "Pastor(a) Emérito(a)", "Pastor Emeritus"], ["other", "Otro", "Other"]] },
        { k: "role_other", l: ["Especifique su rol", "Please specify your role"], w: 6, req: 1, when: "role=other" },
        { k: "founding_story", type: "area", req: 1, when: "role=Founding Pastor", l: ["Fundación de la iglesia y trasfondo ministerial", "Church Founding and Ministry Background"],
          desc: [["Si usted es el pastor fundador de su iglesia actual, describa brevemente cómo se estableció la iglesia. Indique si fue enviado, comisionado o respaldado por otra iglesia o líder ministerial, o si la iglesia se estableció de manera independiente.",
                  "Si la fundación implicó una transición desde otra congregación, describa las circunstancias de esa transición, incluida la comunicación con su liderazgo anterior y si queda algún asunto sin resolver.",
                  "Reconocemos que las iglesias se establecen en circunstancias diferentes. Esta pregunta nos ayuda a comprender su trasfondo ministerial y las relaciones en torno a la fundación de su iglesia."],
                 ["If you are the founding pastor of your current church, please briefly describe how the church was established. Include whether you were sent, commissioned, or supported by another church or ministerial leader, or whether the church was established independently.",
                  "If the founding involved a transition from another congregation, please describe the circumstances of that transition, including communication with your former leadership and whether any concerns remain unresolved.",
                  "We recognize that churches are established under different circumstances. This question helps us understand your ministry background and the relationships surrounding the founding of your church."]] },
        { k: "church_city", l: ["Ciudad y estado", "City and state"], w: 2 },
        { k: "founded", when: "leads=y", l: ["Año de fundación", "Year founded"], w: 2, in: "num" },
        { k: "website", l: ["Sitio web", "Website"], w: 2, opt: 1 },
        { k: "attendance", when: "leads=y", l: ["Asistencia promedio", "Average attendance"], type: "radio", o: [["lt50", "Menos de 50", "Under 50"], ["50", "50 a 150", "50 to 150"], ["150", "150 a 500", "150 to 500"], ["500", "Más de 500", "Over 500"]] },
        { k: "gov", when: "leads=y", l: ["Forma de gobierno", "Church government"], type: "radio", o: [["ind", "Independiente", "Independent"], ["elders", "Ancianos", "Elders"], ["board", "Junta directiva", "Board"], ["other", "Otra", "Other"]] },
        { k: "gov_other", l: ["Especifique la forma de gobierno", "Please specify the church government"], w: 6, when: "gov=other" },
        { k: "ministries", when: "leads=y", l: ["Ministerios activos", "Active ministries"], type: "checks", other: 1, o: [["kids", "Niños", "Children"], ["youth", "Jóvenes", "Youth"], ["couples", "Matrimonios", "Couples"], ["worship", "Alabanza", "Worship"], ["missions", "Misiones", "Missions"], ["groups", "Grupos pequeños", "Small groups"]] }
      ] },
    { id: "a6", t: ["Trabajo y sostenimiento", "Work and support"],
      f: [
        { k: "work", l: ["Su dedicación al ministerio", "Your ministry commitment"], type: "radio", req: 1, o: [["ft", "Tiempo completo", "Full time"], ["bi", "Bivocacional", "Bivocational"], ["vo", "Voluntario", "Volunteer"]] },
        { k: "job", l: ["¿En qué trabaja?", "What is your other job?"], w: 3, when: "work=bi" },
        { k: "hours", l: ["Horas por semana", "Hours per week"], w: 3, in: "num", when: "work=bi" },
        { k: "provides", when: "leads=y", l: ["La iglesia le provee", "Your church provides"], s2: ["marque los que apliquen", "check all that apply"], type: "checks", o: [["salary", "Salario", "Salary"], ["health", "Seguro médico", "Health insurance"], ["retire", "Plan de retiro", "Retirement plan"], ["housing", "Asignación para vivienda pastoral", "Housing allowance"], ["parsonage", "Casa pastoral", "Parsonage"], ["other", "Otro", "Other"], ["none", "Ninguno", "None"]] },
        { k: "support", when: "leads=n", l: ["¿Cómo se sostiene su ministerio?", "How is your ministry supported?"], s2: ["marque los que apliquen", "check all that apply"], type: "checks", o: [["salary", "Salario de su ministerio u organización", "Salary from your ministry or organization"], ["benefits", "Beneficios (seguro médico, plan de retiro)", "Benefits (health insurance, retirement plan)"], ["honoraria", "Ofrendas u honorarios cuando lo invitan", "Offerings or honoraria when invited"], ["missionary", "Sostén misionero (iglesias o donantes)", "Missionary support (churches or donors)"], ["secular", "Trabajo secular", "Secular job"], ["pension", "Pensión o retiro", "Pension or retirement"], ["other", "Otro", "Other"], ["none", "Ninguno por ahora", "None for now"]] },
        { k: "support_other", l: ["Especifique cómo más se sostiene", "Please specify other support"], w: 6, when: "support=other" },
        { k: "provides_other", l: ["Especifique qué más le provee", "Please specify what else"], w: 6, when: "provides=other" }
      ] },
    { id: "a7", t: ["Historial y formación", "Background and training"],
      f: [
        { k: "prev_min", l: ["Ministerios anteriores", "Previous ministries"], type: "area", opt: 1, ph: ["Iglesia, rol y años. Ej.: Iglesia Betel, pastor asociado, 2012–2018", "Church, role and years. E.g. Bethel Church, associate pastor, 2012–2018"] },
        { k: "ordained_by", l: ["¿Quién le ordenó?", "Who ordained you?"], w: 3, ph: ["Iglesia, concilio o pastor", "Church, council or pastor"] },
        { k: "ordained_year", l: ["Año de ordenación", "Year of ordination"], w: 3, in: "num" },
        { k: "creds", l: ["Credenciales actuales o anteriores", "Current or previous credentials"], opt: 1, ph: ["Organización y año", "Organization and year"] },
        { k: "revoked", l: ["¿Alguna credencial le fue retirada?", "Has a credential ever been revoked?"], type: "radio", o: [["n", "No", "No"], ["y", "Sí", "Yes"]] },
        { k: "revoked_why", l: ["Explique brevemente", "Please explain briefly"], type: "area", when: "revoked=y" },
        { k: "studies", l: ["Estudios bíblicos o teológicos", "Biblical or theological studies"], opt: 1, ph: ["Institución y programa", "Institution and program"] }
      ] }
  ];

  // Lo que le urge / lo que necesita (las llaves viejas se conservan para las aplicaciones anteriores)
  var NEEDS = [
    ["mentor", "Mentoría pastoral", "Pastoral mentoring"], ["care", "Cuidado pastoral o consejería", "Pastoral care or counseling"],
    ["lead", "Formación de líderes", "Leadership training"], ["resources", "Materiales y recursos", "Materials and resources"],
    ["legal", "Incorporación o asuntos legales", "Incorporation or legal matters"], ["church_fin", "Finanzas de la iglesia", "Church finances"],
    ["personal_fin", "Finanzas personales y retiro", "Personal finances and retirement"], ["youth", "Ministerio de jóvenes", "Youth ministry"],
    ["family", "Matrimonio y familia", "Marriage and family"], ["fellow", "Compañerismo con otros pastores", "Fellowship with other pastors"],
    ["creds", "Credenciales para mi equipo", "Credentials for my team"]
  ];
  var B = [
    { id: "b1", t: ["Dónde está hoy", "Where you are today"], h: ["Una sola pregunta, la más importante.", "One question, the most important one."],
      f: [
        { k: "season", l: ["¿Cómo describiría la temporada que vive hoy?", "How would you describe the season you are in today?"], type: "radio", cards: 1, o: [["thriving", "Floreciendo", "Thriving"], ["stable", "Estable", "Stable"], ["tired", "En necesidad de renovación", "In need of renewal"], ["crisis", "Tiempos difíciles", "Challenging times"]] }
      ] },
    { id: "b2", t: ["Prioridades y áreas de apoyo", "Priorities and areas of support"], h: ["Ayúdenos a entender sus prioridades y en qué áreas KAI puede servirle mejor.", "Help us understand your priorities and the areas in which KAI can best serve you."],
      f: [
        { k: "priorities", type: "pick", l: ["¿Cuáles son sus necesidades más urgentes?", "What are your most pressing needs?"], s: ["Seleccione hasta 3, en orden de importancia.", "Select up to 3, in order of importance."] },
        { k: "resources", l: ["¿Qué recursos o herramientas le serían útiles?", "Which resources or tools would be most helpful?"], type: "checks", other: 1, o: [["disc", "Discipulado", "Discipleship"], ["admin", "Administración", "Administration"], ["couns", "Consejería", "Counseling"], ["youth", "Jóvenes", "Youth"], ["kids", "Niños", "Children"]] },
        { k: "orient", l: ["¿En qué aspectos administrativos le gustaría recibir orientación?", "In which administrative areas would you like guidance?"], s2: ["marque los que apliquen", "check all that apply"], type: "checks", other: 1, o: [["incorp", "Incorporar la iglesia", "Incorporating the church"], ["501", "Obtener el 501(c)(3)", "Obtaining 501(c)(3) status"], ["bylaws", "Estatutos y junta directiva", "Bylaws and board"], ["structure", "Estructurar ministerios y liderazgo", "Structuring ministries and leadership"], ["done", "Mi iglesia ya está incorporada y tiene 501(c)(3)", "My church is already incorporated and has 501(c)(3)"]] }
      ] },
    { id: "b3", t: ["Formación de líderes", "Leader development"],
      f: [
        { k: "lt_process", l: ["Además del discipulado, ¿su iglesia tiene un proceso formal de desarrollo ministerial?", "Beyond discipleship, does your church have a formal process for ministry development?"], type: "radio", o: [["y", "Sí", "Yes"], ["n", "No", "No"]] },
        { k: "lt_character", l: ["¿Qué tan importante es que sus líderes sean formados desde el carácter y no solo desde las habilidades?", "How important is it that your leaders are formed in character, not only in skills?"], type: "scale", sc: IMP },
        { k: "lt_count", l: ["¿Cuántas personas podrían recibir formación?", "How many people could receive training?"], w: 3, type: "radio", o: [["1", "1–5", "1–5"], ["6", "6–15", "6–15"], ["16", "Más de 15", "More than 15"]] },
        { k: "lt_self", l: ["¿Le interesa recibir formación formal para usted?", "Are you interested in formal training for yourself?"], w: 3, type: "radio", o: [["y", "Sí", "Yes"], ["n", "No por ahora", "Not now"]] },
        { k: "morphe", type: "morphe", o: [["contact", "Sí, que me contacten", "Yes, please contact me"], ["no", "No por ahora", "Not now"]] }
      ] },
    { id: "b4", t: ["Su iglesia", "Your church"], h: ["El detalle solo aparece si contesta que sí.", "The details only appear if you answer yes."],
      f: [
        { k: "youth_int", l: ["¿Le interesa que sus jóvenes convivan con otras iglesias?", "Would you like your youth to fellowship with other churches?"], type: "radio", o: Y },
        { k: "youth_acts", l: ["¿Qué actividades les interesarían?", "Which activities would interest them?"], type: "checks", when: "youth_int=y", other: 1, o: [["retreats", "Retiros y campamentos", "Retreats and camps"], ["sports", "Deportes", "Sports"], ["worship", "Noches de alabanza", "Worship nights"], ["service", "Misiones y servicio", "Missions and service"], ["conf", "Conferencias", "Conferences"]] },
        { k: "ws", l: ["¿Puede ser anfitrión de un taller ministerial en su iglesia local?", "Are you able to host a ministry workshop at your local church?"], type: "radio", o: [["y", "Sí", "Yes"], ["n", "No", "No"]] },
        { k: "ws_topics", l: ["¿Sobre qué temas?", "Which topics?"], type: "checks", other: 1, when: "ws=y", o: [["couples", "Matrimonios", "Marriage"], ["parent", "Crianza", "Parenting"], ["fin", "Finanzas", "Finances"], ["lead", "Liderazgo", "Leadership"], ["evang", "Evangelismo", "Evangelism"], ["couns", "Consejería", "Counseling"], ["worship", "Alabanza", "Worship"], ["admin", "Administración", "Administration"]] }
      ] },
    { id: "b5", t: ["Para cerrar", "To finish"],
      f: [{ k: "one_thing", l: ["Si KAI pudiera ayudarle con una sola cosa este año, ¿cuál sería?", "If KAI could help you with just one thing this year, what would it be?"], type: "area" }] }
  ];

  var C = [
    { id: "c1", t: ["Usted", "You"],
      f: [
        { k: "spirit", l: ["¿Cómo describiría su salud espiritual en esta temporada?", "How would you describe your spiritual health in this season?"], type: "scale", sc: WELL },
        { k: "devotion", l: ["¿Con qué frecuencia tiene tiempo personal con Dios, aparte de preparar sermones?", "How often do you spend personal time with God, apart from sermon preparation?"], type: "radio", o: [["daily", "Diario", "Daily"], ["weekly", "Varias veces por semana", "Several times a week"], ["few", "Pocas veces", "Rarely"], ["never", "Casi nunca", "Almost never"]] },
        { k: "health", l: ["¿Cómo está su salud física?", "How is your physical health?"], type: "scale", sc: WELL },
        { k: "health_cond", l: ["¿Alguna condición de salud afecta su ministerio?", "Does any health condition affect your ministry?"], opt: 1 },
        { k: "burnout", l: ["En los últimos 6 meses, ¿se ha sentido agotado, desanimado o con ganas de dejar el ministerio?", "In the last 6 months, have you felt exhausted, discouraged or like leaving the ministry?"], type: "radio", o: [["never", "Nunca", "Never"], ["some", "A veces", "Sometimes"], ["often", "A menudo", "Often"]] },
        { k: "rest", l: ["¿Toma un día de descanso cada semana?", "Do you take a day of rest each week?"], w: 3, type: "radio", o: [["y", "Sí", "Yes"], ["some", "A veces", "Sometimes"], ["n", "No", "No"]] },
        { k: "vacation", l: ["¿Cuándo fueron sus últimas vacaciones?", "When was your last vacation?"], w: 3, type: "radio", o: [["year", "Este año", "This year"], ["12", "1–2 años", "1–2 years ago"], ["2", "Más de 2 años", "Over 2 years ago"]] },
        { k: "confidant", l: ["¿Tiene a alguien con quien pueda hablar en confianza?", "Do you have someone you can speak with in confidence?"], w: 3, type: "radio", o: Y },
        { k: "counsel", l: ["¿Le gustaría recibir consejería o cuidado pastoral?", "Would you like to receive counseling or pastoral care?"], w: 3, type: "radio", o: [["y", "Sí", "Yes"], ["n", "No", "No"]] }
      ] },
    { id: "c2", t: ["Matrimonio y familia", "Marriage and family"], h: ["Si no está casado(a) o no tiene hijos, puede saltar las preguntas que no apliquen.", "If you are not married or have no children, skip the questions that do not apply."], skip: 1,
      f: [
        { k: "marriage", l: ["¿Cómo calificaría su matrimonio en esta temporada?", "How would you rate your marriage in this season?"], type: "scale", sc: WELL },
        { k: "spouse_view", l: ["¿Cómo calificaría su cónyuge esta temporada de ministerio?", "How would your spouse rate this ministry season?"], type: "radio", o: [["blessing", "Como bendición", "As a blessing"], ["burden", "Como carga", "As a burden"], ["both", "Un poco de ambas", "A bit of both"]] },
        { k: "kids", l: ["¿Cómo calificarían sus hijos su experiencia en la iglesia?", "How would your children rate their experience in church?"], type: "radio", o: [["pos", "Positivamente", "Positively"], ["neg", "Negativamente", "Negatively"], ["chal", "Desafiante", "Challenging"]] },
        { k: "family_time", l: ["¿Programa tiempo de calidad en familia cada semana?", "Do you schedule quality family time each week?"], type: "radio", o: [["y", "Sí", "Yes"], ["some", "A veces", "Sometimes"], ["n", "No", "No"]] },
        { k: "family_prayer", l: ["¿Hay alguna situación familiar por la que le gustaría que oremos o le acompañemos?", "Is there a family situation you would like us to pray about or walk with you through?"], type: "area", opt: 1, optL: ["Opcional, totalmente confidencial", "Optional, fully confidential"] }
      ] },
    { id: "c3", t: ["Finanzas", "Finances"],
      f: [
        { k: "fin_stable", l: ["¿Cómo calificaría la situación financiera de su familia?", "How would you rate your family financial situation?"], type: "scale", sc: [["Muy estable", "Very stable"], ["Muy difícil", "Very hard"]] },
        { k: "fin_pressure", l: ["¿La presión económica afecta su ministerio o su familia?", "Does financial pressure affect your ministry or family?"], type: "radio", o: [["none", "Nada", "Not at all"], ["some", "Un poco", "Somewhat"], ["much", "Mucho", "A lot"]] },
        { type: "finbox" },
        { k: "fin_has", l: ["¿Con cuáles de estos cuenta hoy?", "Which of these do you have today?"], type: "checks", box: 1, o: [["retire", "Plan de retiro", "Retirement plan"], ["life", "Seguro de vida", "Life insurance"], ["edu", "Ahorro para la educación de sus hijos", "Savings for your children's education"], ["emerg", "Fondo de emergencia", "Emergency fund"], ["will", "Testamento o plan para su familia", "Will or estate plan"], ["none", "Ninguno", "None"]] },
        { k: "fin_protect", l: ["Si algo le pasara mañana, ¿qué tan protegida quedaría su familia?", "If something happened to you tomorrow, how protected would your family be?"], type: "scale", box: 1, sc: [["Nada", "Not at all"], ["Muy protegida", "Well protected"]] },
        { k: "fin_retire", l: ["¿Qué tan preparado se siente para su retiro?", "How prepared do you feel for retirement?"], type: "scale", box: 1, sc: [["Nada", "Not at all"], ["Muy preparado", "Well prepared"]] },
        { type: "offer", box: 1 },
        { k: "fin_consult", l: ["¿Le gustaría una consulta?", "Would you like a consultation?"], type: "radio", box: 1, o: [["y", "Sí, que me contacten", "Yes, please contact me"], ["t", "Prefiero un taller de educación financiera", "I prefer a financial education workshop"], ["n", "No por ahora", "Not now"]] },
        { k: "fin_consent", type: "consent", box: 1, when: "fin_consult=y,t" }
      ] },
    { id: "c4", t: ["Ministerio", "Ministry"],
      f: [
        { k: "conflict", l: ["¿Está enfrentando actualmente algún desafío serio con su iglesia?", "Are you currently experiencing any serious challenges with your church right now?"], type: "radio", o: [["serious", "Sí", "Yes"], ["n", "No", "No"]] },
        { k: "lonely", l: ["¿Se siente solo en el liderazgo?", "Do you feel alone in leadership?"], type: "radio", o: [["never", "Nunca", "Never"], ["some", "A veces", "Sometimes"], ["often", "A menudo", "Often"]] },
        { k: "loss", l: ["¿Ha vivido alguna pérdida o crisis reciente, personal o en la iglesia?", "Have you gone through a recent loss or crisis, personally or in the church?"], type: "radio", o: [["n", "No", "No"], ["y", "Sí", "Yes"]] },
        { k: "loss_text", l: ["Si desea, cuéntenos brevemente", "If you wish, tell us briefly"], type: "area", opt: 1, when: "loss=y" }
      ] },
    { id: "c5", t: ["Cómo podemos ayudar", "How we can help"],
      f: [
        { k: "support", l: ["¿En qué áreas le gustaría apoyo de KAI?", "In which areas would you like KAI's support?"], type: "checks", other: 1, o: [["prayer", "Oración", "Prayer"], ["mentor", "Mentoría", "Mentoring"], ["couns", "Consejería", "Counseling"], ["rest", "Descanso o retiro", "Rest or retreat"], ["training", "Formación", "Training"], ["finance", "Planeación financiera", "Financial planning"], ["family", "Familia", "Family"]] },
        { k: "wants_contact", l: ["¿Le gustaría que alguien del equipo pastoral le contacte personalmente?", "Would you like someone from the pastoral team to contact you personally?"], type: "radio", o: [["y", "Sí", "Yes"], ["later", "Más adelante", "Later"], ["n", "No", "No"]] },
        { k: "more", l: ["¿Hay algo más que quiera que sepamos?", "Is there anything else you would like us to know?"], type: "area", opt: 1 },
        { type: "care" }
      ] }
  ];

  var BENEFITS = [
    ["care", "Cuidado pastoral", "Pastoral care", 7], ["mentor", "Mentoría pastoral", "Pastoral mentoring", 0], ["lead", "Formación de liderazgo", "Leadership training", 1],
    ["fellow", "Compañerismo y conexión", "Fellowship & connection", 2], ["regional", "Liderazgo regional", "Regional leadership", 3], ["resources", "Recursos ministeriales", "Ministry resources", 4],
    ["creds", "Licencias y credenciales", "Licenses & credentials", 5], ["conf", "Conferencia anual", "Annual conference", 6]
  ];
  // order shown on screen = site order
  BENEFITS.sort(function (a, b) { return a[3] - b[3]; });

  // [valor (va en la credencial, en inglés), español, inglés]
  var TITLES = [["Apostle", "Apóstol", "Apostle"], ["Assistant Pastor", "Pastor(a) Asistente", "Assistant Pastor"], ["Bishop", "Obispo", "Bishop"], ["Deacon", "Diácono / Diaconisa", "Deacon"], ["Evangelist", "Evangelista", "Evangelist"], ["Missionary", "Misionero(a)", "Missionary"], ["Ordained Minister", "Ministro(a) Ordenado(a)", "Ordained Minister"], ["Pastor", "Pastor(a)", "Pastor"], ["Pastor Emeritus", "Pastor(a) Emérito(a)", "Pastor Emeritus"]];

  var DOCS = {
    pacto: { t: ["Pacto de Membresía", "Membership Covenant"],
      i: ["Al unirme a Kingdom Alliance International E4:4 (KAI), una alianza voluntaria de pastores autónomos, me comprometo delante de Dios y de mis hermanos en el ministerio a lo siguiente:", "By joining Kingdom Alliance International E4:4 (KAI), a voluntary alliance of autonomous pastors, I commit before God and my fellow ministers to the following:"],
      x: [
        [["Fe", "Afirmar la Declaración de Fe de KAI y enseñar y ministrar conforme a las Sagradas Escrituras."], ["Faith", "To affirm KAI's Statement of Faith and to teach and minister according to the Holy Scriptures."]],
        [["Integridad", "Vivir y ministrar con integridad personal, familiar, financiera y moral, de acuerdo con el Código de Ética Ministerial de KAI."], ["Integrity", "To live and minister with personal, family, financial and moral integrity, in keeping with KAI's Ministerial Code of Ethics."]],
        [["Unidad, no uniformidad", "Caminar en comunión con los demás miembros de la alianza, honrando nuestras diferencias de tradición, estilo y cultura, y buscando siempre la unidad en lo esencial."], ["Unity, not uniformity", "To walk in fellowship with the other members of the alliance, honoring our differences in tradition, style and culture, and always seeking unity in what is essential."]],
        [["Respeto a la autonomía", "Reconozco que KAI existe para servir y no para controlar. Mi iglesia conserva su propio gobierno, sus bienes y sus decisiones. KAI no asume responsabilidad legal ni financiera por mi iglesia o ministerio, ni yo por KAI."], ["Respect for autonomy", "I recognize that KAI exists to serve, not to control. My church keeps its own government, property and decisions. KAI assumes no legal or financial responsibility for my church or ministry, nor do I for KAI."]],
        [["Participación", "Participar, en la medida de mis posibilidades, en las reuniones, convivios, actividades de formación y la conferencia anual de la alianza."], ["Participation", "To take part, as I am able, in the alliance's meetings, fellowship gatherings, training activities and annual conference."]],
        [["Rendición de cuentas", "Recibir con humildad el consejo y la corrección fraterna, y someterme al proceso de restauración de KAI cuando sea necesario."], ["Accountability", "To receive counsel and brotherly correction with humility, and to submit to KAI's restoration process when necessary."]],
        [["Cuidado mutuo", "Orar por los demás pastores y sus familias, animarlos en el ministerio y pedir ayuda cuando yo la necesite."], ["Mutual care", "To pray for the other pastors and their families, encourage them in ministry and ask for help when I need it."]],
        [["Cuota y credencial", "Pagar la cuota anual de membresía. Entiendo que la credencial ministerial es válida por un año, se renueva con el pago de la cuota y una buena relación con la alianza, y puede suspenderse o retirarse conforme al Código de Ética Ministerial."], ["Fee and credential", "To pay the annual membership fee. I understand that the ministry credential is valid for one year, is renewed with payment of the fee and good standing with the alliance, and may be suspended or revoked under the Ministerial Code of Ethics."]],
        [["Vigencia", "Este pacto se renueva cada año junto con mi membresía. Puedo retirarme de la alianza en cualquier momento mediante aviso por escrito."], ["Term", "This covenant renews each year with my membership. I may withdraw from the alliance at any time with written notice."]]
      ],
      c: ["Firmo este pacto libremente, con el deseo de honrar a Cristo y de servir junto a mis hermanos en el ministerio.", "I sign this covenant freely, desiring to honor Christ and to serve alongside my fellow ministers."] },
    etica: { t: ["Código de Ética Ministerial", "Ministerial Code of Ethics"],
      i: ["Como ministro con credencial de Kingdom Alliance International, me comprometo a observar los siguientes principios en mi vida y ministerio:", "As a credentialed minister of Kingdom Alliance International, I commit to observe the following principles in my life and ministry:"],
      x: [
        [["Vida personal", "Mantener una vida de integridad moral, sobriedad y honestidad, y una vida devocional constante."], ["Personal life", "To maintain a life of moral integrity, sobriety and honesty, and a consistent devotional life."]],
        [["Matrimonio y familia", "Ser fiel en mi matrimonio y dar a mi familia el cuidado y el tiempo que le corresponden, sin sacrificarla por el ministerio."], ["Marriage and family", "To be faithful in my marriage and give my family the care and time they deserve, without sacrificing them for the ministry."]],
        [["Finanzas", "Administrar con transparencia los recursos de la iglesia, mantener separados los fondos personales de los de la iglesia, cumplir con mis obligaciones fiscales y no usar el ministerio para obtener beneficios indebidos."], ["Finances", "To manage church resources transparently, keep personal and church funds separate, meet my tax obligations and never use the ministry for improper gain."]],
        [["Autoridad espiritual", "Servir a la congregación con amor, sin manipulación, intimidación ni abuso de autoridad espiritual."], ["Spiritual authority", "To serve the congregation with love, without manipulation, intimidation or abuse of spiritual authority."]],
        [["Confidencialidad", "Guardar la confidencialidad de la consejería pastoral, excepto cuando la ley exija reportar o exista riesgo de daño para alguien."], ["Confidentiality", "To keep pastoral counseling confidential, except when the law requires reporting or someone is at risk of harm."]],
        [["Protección de menores y personas vulnerables", "No tolerar ningún tipo de abuso, cumplir las leyes de reporte obligatorio y procurar que mi iglesia tenga medidas de protección para niños, jóvenes y personas vulnerables."], ["Protection of minors and vulnerable people", "To tolerate no abuse of any kind, comply with mandatory reporting laws and ensure my church has safeguards for children, youth and vulnerable people."]],
        [["Relación con otros pastores", "Hablar con respeto de otros ministros e iglesias, no buscar atraer a miembros de otras congregaciones y resolver los conflictos conforme a Mateo 18:15-17."], ["Relationship with other pastors", "To speak respectfully of other ministers and churches, not seek to draw members from other congregations, and resolve conflicts according to Matthew 18:15-17."]],
        [["Uso de la credencial", "Usar la credencial solo para fines ministeriales legítimos, no hablar en nombre de KAI sin autorización y cumplir las leyes de mi estado para oficiar bodas y otros actos ministeriales."], ["Use of the credential", "To use the credential only for legitimate ministry purposes, not speak on behalf of KAI without authorization, and follow my state's laws for officiating weddings and other ministerial acts."]],
        [["Conducta pública y digital", "Conducirme con dignidad en público y en las redes sociales, de manera que honre a Cristo y a la alianza."], ["Public and online conduct", "To conduct myself with dignity in public and on social media, in a way that honors Christ and the alliance."]],
        [["Aviso a KAI", "Informar a la alianza si enfrento una acusación formal, un proceso legal o una situación que afecte gravemente mi ministerio."], ["Notice to KAI", "To inform the alliance if I face a formal accusation, legal proceedings or a situation that seriously affects my ministry."]],
        [["Faltas y restauración", "Entiendo que KAI puede suspender o retirar una credencial en casos de falta moral, abuso, fraude o conducta que deshonre el ministerio. El proceso incluye una conversación personal, la revisión de un comité, la oportunidad de ser escuchado y, cuando corresponda, un plan de restauración."], ["Misconduct and restoration", "I understand that KAI may suspend or revoke a credential in cases of moral failure, abuse, fraud or conduct that dishonors the ministry. The process includes a personal conversation, review by a committee, an opportunity to be heard and, when appropriate, a restoration plan."]]
      ] },
    datos: { t: ["Uso y Protección de Datos", "Data Use and Protection"],
      i: ["KAI cuida la información que usted comparte en esta aplicación. Así la usamos y la protegemos:", "KAI cares for the information you share in this application. This is how we use and protect it:"],
      x: [
        [["Qué recopilamos", "Los datos que usted escribe en la aplicación, su foto y su firma."], ["What we collect", "The information you enter in the application, your photo and your signature."]],
        [["Para qué la usamos", "Para evaluar su membresía, emitir su credencial, servirle con los beneficios de la alianza y brindarle cuidado pastoral."], ["How we use it", "To evaluate your membership, issue your credential, serve you with the alliance's benefits and provide pastoral care."]],
        [["Quién la ve", "La Parte A la revisa el Comité de Membresía; la Parte B, el liderazgo de KAI. Lo que comparta en su entrevista sobre su vida personal y familiar es confidencial y solo lo ve el equipo de cuidado pastoral."], ["Who sees it", "Part A is reviewed by the Membership Committee; Part B by KAI's leadership. What you share in your interview about your personal and family life is confidential and seen only by the pastoral care team."]],
        [["Qué no hacemos", "No vendemos ni compartimos su información con terceros. Solo la compartimos con su autorización expresa (por ejemplo, su nombre y contacto con el equipo de planeación financiera) o cuando la ley lo exija."], ["What we don't do", "We do not sell or share your information with third parties. We share it only with your express permission (for example, your name and contact with the financial planning team) or when required by law."]],
        [["Verificación de credencial", "La página pública de verificación muestra únicamente su nombre, título, número de credencial, foto y vigencia. Nunca muestra sus datos de contacto."], ["Credential verification", "The public verification page shows only your name, title, credential number, photo and validity. It never shows your contact details."]],
        [["Seguridad", "Guardamos la información en sistemas seguros, con acceso restringido a las personas autorizadas."], ["Security", "We store information in secure systems, with access limited to authorized people."]],
        [["Sus derechos", "Puede pedir ver, corregir o eliminar sus datos escribiendo a info@kaie44.org."], ["Your rights", "You may ask to see, correct or delete your data by writing to info@kaie44.org."]]
      ] }
  };

  return { A: A, B: B, C: C, NEEDS: NEEDS, BENEFITS: BENEFITS, TITLES: TITLES, DOCS: DOCS };
})();
