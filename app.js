let entries = JSON.parse(localStorage.getItem("financeX")) || [];

function save() {
localStorage.setItem("financeX", JSON.stringify(entries));
render();
}

function addEntry(type, amount, category) {

entries.push({
type,
amount: Number(amount),
category,
date: new Date().toISOString()
});

save();
}

function render() {

let income = 0;
let expense = 0;

entries.forEach(e => {
if (e.type === "income") income += e.amount;
if (e.type === "expense") expense += e.amount;
});

let balance = income - expense;

document.getElementById("incomeTotal").textContent = "$" + income.toFixed(2);
document.getElementById("expenseTotal").textContent = "$" + expense.toFixed(2);
document.getElementById("balanceTotal").textContent = "$" + balance.toFixed(2);

let rate = income === 0 ? 0 : ((income - expense) / income) * 100;
document.getElementById("savingRate").textContent = rate.toFixed(0) + "%";

updateRing(income, expense);
renderList();
}

function updateRing(income, expense){

let total = income + expense;

if(total === 0) return;

let spent = (expense/total)*100;
let saved = (income-expense)/total*100;

let ring = document.getElementById("spendingRing");

ring.style.background =
`conic-gradient(
#ff4d88 0 ${spent}%,
#4a6aff ${spent}% ${spent+saved}%,
#ddd ${spent+saved}% 100%)`;

}

function renderList(){

let container = document.getElementById("entryList");
container.innerHTML = "";

entries.slice().reverse().forEach(e => {

let div = document.createElement("div");

div.className = "entry";

div.innerHTML = `
<span>${e.category}</span>
<span>${e.type}</span>
<span>$${e.amount}</span>
`;

container.appendChild(div);

});
}

document.getElementById("addBtn").onclick = () => {

let type = document.getElementById("type").value;
let amount = document.getElementById("amount").value;
let cat = document.getElementById("category").value;

addEntry(type, amount, cat);

};

render();
