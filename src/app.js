import { askTutor, evaluateCode, generateNotes, generateQuiz, planRoadmap, ragAnswer } from './services/aiGuru.js';
import { analytics, topics } from './data/sampleData.js';

const tabs = {
  tutor: '🎓 AI Tutor', rag: '📄 PDF RAG', quiz: '✨ Quiz', code: '💻 Code Review', notes: '🧠 Notes', roadmap: '🛣️ Planner Agent', voice: '🎙️ Voice Tutor', admin: '🛡️ Admin'
};
const prompt = document.querySelector('#prompt');
const pdf = document.querySelector('#pdf');
const output = document.querySelector('#output');
const title = document.querySelector('#title');
let active = 'tutor';
prompt.value = 'Explain Binary Search at beginner, intermediate and advanced levels.';
pdf.value = 'Operating systems manage processes, memory, files, and devices. A process is a program in execution. Scheduling decides which process runs next.';

function renderCards(){
  const cards = [['Learning streak','12 days'],['Progress','74%'],['Completed topics','18'],['Weak topics','DBMS indexing, OS scheduling']];
  document.querySelector('#cards').innerHTML = cards.map(([k,v])=>`<article><span>${k}</span><strong>${v}</strong></article>`).join('');
}
function renderTabs(){
  document.querySelector('#tabs').innerHTML = Object.entries(tabs).map(([k,v])=>`<button data-tab="${k}" class="${active===k?'active':''}">${v}</button>`).join('');
  document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{active=btn.dataset.tab; title.textContent=tabs[active]; pdf.hidden=active!=='rag'; renderTabs(); run();}));
}
function run(){
  const actions = {
    tutor: () => askTutor(prompt.value),
    rag: () => ragAnswer(prompt.value, pdf.value),
    quiz: () => generateQuiz(prompt.value || 'Binary Search'),
    code: () => evaluateCode(prompt.value || 'def add(a,b): return a+b'),
    notes: () => generateNotes(prompt.value || 'Machine Learning'),
    roadmap: () => planRoadmap(prompt.value || 'I want Google Internship'),
    voice: () => `Voice flow ready: browser speech-to-text captures your doubt, EduGuru responds, and text-to-speech reads: ${askTutor(prompt.value).slice(0, 180)}...`,
    admin: () => 'Admin snapshot: 128 students, 42 PDFs indexed, 91% safe-request pass rate, 1.8s median AI latency.'
  };
  output.textContent = actions[active]();
}
function chart(id, data, key){
  document.querySelector(id).innerHTML = data.map(item=>`<div><span>${item.name||item.week}</span><b style="height:${item[key]*2}px"></b><em>${item[key]}</em></div>`).join('');
}
renderCards(); renderTabs(); run(); chart('#lineChart', analytics, 'accuracy'); chart('#barChart', topics, 'score');
document.querySelector('#run').addEventListener('click', run);
