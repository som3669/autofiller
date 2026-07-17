const $ = (id) => document.getElementById(id);

$("fill").addEventListener("click", () => {
  $("status").textContent = "Filling…";
  chrome.runtime.sendMessage({ type: "fillActive" }, (r) => {
    if (!r) { $("status").textContent = "No response"; return; }
    if (r.error) { $("status").textContent = "⚠ " + r.error; return; }
    $("status").textContent = r.filled ? `✓ Filled ${r.filled} field${r.filled > 1 ? "s" : ""}` : "No matching fields found";
  });
});

async function summary() {
  const { profile = {}, rules = [] } = await chrome.storage.sync.get({ profile: {}, rules: [] });
  const set = Object.values(profile).filter((v) => v && String(v).trim()).length;
  if (!set && !rules.length) {
    $("summary").innerHTML = '<span class="muted">No profile yet. Click <b>Edit profile & rules</b> to set it up.</span>';
    return;
  }
  $("summary").innerHTML = `Profile fields set: <b>${set}</b> &nbsp;·&nbsp; Custom rules: <b>${rules.length}</b>`;
}
summary();
