// Get DB
let root = '/ref'
let register = true

function isIphonePWA() {
  const isIOS = /iphone/i.test(navigator.userAgent);
  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  return isIOS && isStandalone;
}

if ('serviceWorker' in navigator && register) {
  window.addEventListener('load', () => {
    const APP_VERSION = "1.0.0"
    const reg = navigator.serviceWorker.register(`${root}/sw.js?v=${APP_VERSION}`, {
      scope: "./${root}",
      updateViaCache: "none",
    })

    const julian = document.getElementById('julian')
    const date = new Date()
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    julian.textContent = "Julian Date: " + Math.floor(diff / oneDay);

    checkJSON()
    if(isIphonePWA()) {
      document.getElementById('spacer').style = 'height: 30px'
    }
  });
}

const DB_NAME = "AppDB";
const STORE_NAME = "jsonStore";
const DB_VERSION = 1;

let allPanels
let forms
let ref
let notes
let checklists
let wuc
let decryptKey
let refDes
checkJSON()

function setupDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // key is the string you pass (your "tag")
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Save the entire JSON object under ONE tag.
 * Example tag: "reference"
 */
function saveJSON(db, tag, jsonObject) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const req = store.put(jsonObject, tag);

    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get the entire JSON object back from ONE tag.
 * Returns null if not found.
 */
function getJSON(db, tag) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const req = store.get(tag);

    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Optional: delete the stored JSON for that tag
 */
function deleteJSON(db, tag) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const req = store.delete(tag);

    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

function hasJSON(db, tag) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const req = store.getKey(tag);

    req.onsuccess = () => resolve(req.result !== undefined);
    req.onerror = () => reject(req.error);
  });
}

async function checkJSON() {
  let a = await setupDB()
  let c = await hasJSON(a, 'json')
  let clear = document.getElementById('clearIndexed')

  clear.addEventListener('mousedown', async function() {
    await deleteJSON(a, 'json')
    alert('IndexedDB cleared')
    window.location.reload()
  })

  if(!c) {
    document.getElementById('file-upload').style.display = 'block'
    document.getElementById('blur-back').style.display = 'block'

    let upload = document.getElementById('file')
    let button = document.getElementById('upload-enc')

    button.addEventListener("mousedown", async (e) => {
      const file = upload.files[0];
      if (!file) return;

      try {
        const key = document.getElementById('key')
        const user = document.getElementById('user')
        const text = await file.text();   // Read file as string
        const dec = await decryptAES(text, user.value + key.value)

        decryptKey = user.value + key.value

        if (!dec.ok) {
          if (dec.reason === "decrypt_failed") {
            alert("Wrong password OR file corrupted/tampered.");
          } else {
            alert("Bad file format.");
          }
        } else {
          let json = dec.value

          let d = new Date(dec.value.meta.els)
          let td = new Date()

          if(d < td) {
            alert("Encrypted file has expired")
            return
          }

          await saveJSON(a, "json", text);
          document.getElementById('file-upload').style.display = 'none'
          document.getElementById('blur-back').style.display = 'none'
          loadPage(a)
        }
      } catch (err) {
        console.error("Invalid JSON file:", err);
      }

    });
  } else {
    document.getElementById('file-pass').style.display = 'block'
    document.getElementById('blur-back').style.display = 'block'
    async function l(reason = '') {
      let key = document.getElementById('key-preload')
      let user = document.getElementById('user-preload')
      let cn = await getJSON(a, 'json')
      decryptKey = user.value + key.value
      let content = await decryptAES(cn, decryptKey)

      if(!content.ok) {
        doc.innerHTML = "Error decrypting file"
        return
      } else {
        let d = new Date(content.value.meta.els)
        let td = new Date()
        let doc = document.getElementById('pass-error')

        if(d < td) {
          doc.innerHTML = "Encrypted file has expired"
          deleteJSON(a, 'json')
          window.location.reload()
          return
        }
        document.getElementById('file-pass').style.display = 'none'
        document.getElementById('blur-back').style.display = 'none'
        loadPage(a)
      }
    }
    document.getElementById('file-pass-button').onclick = () => {
      l()
    }

  }
}

async function loadPage(db) {
  let d = await getJSON(db, 'json')
  let d2 = await decryptAES(d, decryptKey)
  let data = d2.value

  if(data != null) {
    forms = data.forms
    allPanels = data.panels
    ref = data.to
    notes = data.notes
    checklists = data.checklists
    wuc = data.WUC
    refDes = data.ref

    document.querySelectorAll('.tohide').forEach(el => {
      el.style.display = 'block';
    });

    let ch = document.getElementById('ch')

    for(let curr of checklists.names) {
      let width = '45%'

      if(window.innerWidth < 450) {
        width = '100%'
      } else if(window.innerWidth > 950) {
        width = '23%'
      }

      let button = document.createElement('button')
      button.setAttribute('onclick', `openChecklist("${curr.obj_name}")`)
      button.style.width = width
      button.textContent = curr.name
      ch.appendChild(button)
    }
    loadList()
    searchWUC()
    searchRefDes()
  }
}

let mode = "view" // Dev or view
// Fuel Load calculator
let maxLoads = {
  slick: 7200, // In pounds
  centerline: 9200,
  wing: 12200,
  wingCenter: 14000,
  arr: []
}
maxLoads.arr = [maxLoads.slick, maxLoads.wing, maxLoads.centerline, maxLoads.wingCenter];

function fuelQuan() {
  let total = document.getElementById('fuel-quantity')
  let selected = document.getElementById('config')
  let model = document.getElementById('model')
  let result = document.getElementById('fuel-result')

  let fullWeight = maxLoads.arr[JSON.parse(selected.value) - 1]

  if(model.value == "2") {
    fullWeight = fullWeight - 1250
  }

  result.textContent = '~<strong>' + Math.floor(((fullWeight - JSON.parse(total.value)) / 6.8) * 100) / 100 + '</strong>G (JP-8) <br><br> ~<strong>' + Math.floor(((fullWeight - JSON.parse(total.value)) / 6.4) * 100) / 100 + '</strong>G (JP-4)'
  result.style = "font-size: 20px"
}

// TO Ref search

//{name: "", MIDAS: "", TO: "", date: ""},

function loadList() { // Load refrences
  let list = document.getElementById('to-search-res')

  for(let i in ref) {
    let li = document.createElement('div')

    li.textContent = ref[i].name.toUpperCase()
    li.onclick = function() {
      if(ref[i].MIDAS != '') {
        alert('TO: ' + ref[i].TO + '    MIDAS: ' + ref[i].MIDAS)
      } else {
        alert('TO: ' + ref[i].TO)
      }
    }
    li.setAttribute('class', "TOSearch-item")

    list.appendChild(li)
  }
}

function searchTO() {
  const input = document.getElementById("searchTO").value.toLowerCase();
  const items = document.querySelectorAll("#to-search-res div");

  items.forEach((item) => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(input) ? "block" : "none";
  });
}

var scene, camera, renderer, controls, mesh, group, light

// Panel Lookup
let panels = allPanels
let newPanels = []

/*
  Mistakes made so far
    i25 - Panel number is 4419
*/

//{cords: [0, 0, 0], name: "Left Clam Shell", number: 2202, type: "Panel"}

function startPanelScreen() {
  let canvas = document.getElementById('panel-3d')
  let c = document.querySelector('#panel-canvas')
  let c2 = document.getElementById('panel-canvas')
  let w = document.getElementById('loader-wrapper')
  let s = document.getElementById('loader-status')
  c2.style.display = 'block'
  canvas.style.display = 'block'
  w.style.display = 'block'

  // Create scene, load 3d model, and setup orbit controls
  if(scene == undefined) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFFFFFF)
    camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: c });
    document.body.appendChild(renderer.domElement);
    renderer.setSize(innerWidth, innerHeight);

    controls = new THREE.OrbitControls(camera, renderer.domElement);

    light = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(light);

    group = new THREE.Group()

    const loader = new THREE.GLTFLoader();
    loader.load(root + '/f16.glb', (gltf) => {
      mesh = gltf.scene
      scene.add(gltf.scene)

      w.style.display = 'none'

      gltf.scene.children[0].children[0].children[0].children[5].visible = false
      gltf.scene.children[0].children[0].children[0].children[3].visible = false

      scene.add(group)
      group.name = 'plane'
    }, (xhr) => {
      let percent = (xhr.loaded / xhr.total * 100)
      percent = Infinity
      s.textContent = percent + '% loaded'
      if(s.textContent == 'Infinity% loaded') {
        s.textContent = '100% loaded'
      }
    },
    (error) => {
      alert('Error loading 3D model');
    });

    // Load past points from localStorage
    let value = allPanels//JSON.parse(localStorage.getItem('panels'))

    for(let i in value) {
      let mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 12, 12),
        new THREE.MeshBasicMaterial({color: 0xFF0000, opacity: 0.4, transparent: true})
      )
      mesh.name = i
      mesh.position.x = value[i].cords[0]
      mesh.position.y = value[i].cords[1]
      mesh.position.z = value[i].cords[2]
      group.add(mesh)
    }

    camera.position.set(100, 60, 100);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const canvas3 = renderer.domElement;

    canvas3.addEventListener('click', (event) => {
      // Convert screen coordinates to NDC
      pointer.x = (event.clientX / canvas3.clientWidth) * 2 - 1;
      pointer.y = -(event.clientY / canvas3.clientHeight) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);

      // Replace `targetMesh` with the mesh you want to test against
      if(mode == 'dev') {
        const intersects = raycaster.intersectObject(scene, true);

        if (intersects.length > 0) {
          if(intersects[0].object.name[0] == 'O') {
            let point = intersects[0].point;

            let hit = intersects[0];
            let vec = hit.point

            let mesh = new THREE.Mesh(
              new THREE.SphereGeometry(1, 15, 15),
              new THREE.MeshBasicMaterial({color: 0xFF0000})
            )
            mesh.position.x = vec.x
            mesh.position.y = vec.y
            mesh.position.z = vec.z
            scene.add(mesh)

            let panelNumber = prompt("Panel Number")
            let name = prompt("Panel Name")
            let type = prompt("Panel or Door")

            if(panelNumber == undefined || panelNumber == "") {
              return
            }

            newPanels.push({cords: [vec.x, vec.y, vec.z], name: name, number: panelNumber, type: type})
          } else {
            alert(allPanels[JSON.parse(intersects[0].object.name)].number + '\n' + JSON.parse(intersects[0].object.name))
          }
        }
      } else if(mode == 'view') {
        const intersects = raycaster.intersectObject(group, true);

        if(intersects.length > 0) {
          let panel = allPanels[intersects[0].object.name]
          alert(panel.type + ' Number: ' + panel.number)
        }
      }
    });
  } else {
    s.style.display = 'none'
  }
  animate()
}

function closePanelScreen() {
  let canvas = document.getElementById('panel-3d')
  canvas.style.display = 'none'

  cancelAnimationFrame(animation)

  let c = document.getElementById('panel-canvas')
  c.style.display = 'none'

}

function oilCons() {
  let data = document.getElementById('fl-time')
  let consumption = 1.5 * JSON.parse(data.value)
  console.log(consumption)

  document.getElementById('cuns-res').textContent = 'MAX CONSUMPTION: ~' + Math.floor(consumption * 10) / 10 + ' hpt(s)'
}
function openLegal() {
  document.getElementById('legal').style.display = 'block'
}

function searchPanel() {
  let search = document.getElementById('searchPanel')

  for(let i in allPanels) {
    let curr = allPanels[i]

    if(curr.number == search.value) {
      const target = new THREE.Vector3(curr.cords[0], curr.cords[1], curr.cords[2]); // the point on the plane
      const direction = new THREE.Vector3(0, 0, 1); // camera offset direction (adjust if needed)
      const distance = 20; // how far from the point you want the camera

      camera.position.copy(target).add(direction.multiplyScalar(distance));
      controls.target.copy(target);
      controls.update();

      // Find the mesh and change the color
      let byName = scene.getObjectByName(i)

      byName.material.color.setHex(0x00FF00)

      window.setTimeout(function() {
        byName.material.color.setHex(0xFF0000)
      }, 5000)

      return
    }
  }
  alert('Could not find Panel')
}

function viewConsole() {
  document.getElementById('console').style.display = 'block'

  let wrapper = document.getElementById('console-content')
  let colors = ['transparent', '#ff8282', '#fcf47c']

  wrapper.innerHTML = ''

  for(let i in consoleOutput) {
    let div = document.createElement('div')
    let content = document.createTextNode(consoleOutput[i][1].slice(0, 200))

    div.appendChild(content)

    if(consoleOutput[i][1].slice(0, 200) != consoleOutput[i][1]) {
      content.textContent += '...'
      let a = document.createElement('a')
      a.textContent = '  View More'
      a.onclick = function() {
        if(a.textContent === '  View More') {
          content.textContent = consoleOutput[i][1]
          a.textContent = '  View Less'
        } else if(a.textContent === '  View Less') {
          content.textContent = consoleOutput[i][1].slice(0, 200) + '...'
          a.textContent = '  View More'
        }

      }

      div.appendChild(a)
    }

    div.style = 'color: #000000; padding: 8px; border-radius: 10px; background-color: ' + colors[consoleOutput[i][0]]
    wrapper.appendChild(div)
  }
}

function searchRefDes() {
  let input = document.getElementById('searchRefDes').value
  let output = document.getElementById('res-search-res')
  let max = 75
  output.innerHTML = ''

  for(let i = 0; i < refDes.length; i++) {
    if(refDes[i].ref.toLowerCase().includes(input) || refDes[i].wuc.toLowerCase().includes(input)) {
      let div = document.createElement('div')
      let text = document.createTextNode("WUC: " + refDes[i].wuc + " — Ref Designator: " + refDes[i].ref)

      div.appendChild(text)
      div.appendChild(document.createElement('br'))
      output.appendChild(div)

      max -= 1
      if(max <= 0) break
    }
  }
}

function searchWUC() {
  const input = document.getElementById("searchWUC").value.toLowerCase();
  const resultsDiv = document.getElementById("wuc-search-res");
  resultsDiv.innerHTML = ''
  let html = "";
  let count = 0;
  const MAX_RESULTS = 75; // prevents DOM overload

  for (let i = 0; i < wuc.length; i++) {
    const item = wuc[i];

    // Search across all fields
    if (item.code.toLowerCase().includes(input) || item.desc.toLowerCase().includes(input) || item.system.toLowerCase().includes(input)) {
      let div = document.createElement("div");

      let strong = document.createElement("strong");

      if(item.code.toLowerCase().includes(input) && input.length > 0) {
        let sp = splitWithChunk(item.code, input)

        for(let i in sp) {
          if(sp[i] == input) {
            let ele = document.createElement('span')
            ele.textContent = sp[i]
            ele.style = 'background-color: #918a3f; padding: 4px; border-radius: 5px'
            strong.appendChild(ele)
          } else {
            let ele = document.createElement('span')
            ele.textContent = sp[i]
            ele.style = 'background-color: transparent; border-radius: 5px'
            strong.appendChild(ele)
          }
        }
      } else {
        strong.textContent = item.code
      }

      const text = document.createElement("span");
      //" — " + item.desc
      if(item.desc.toLowerCase().includes(input) && input.length > 0) {
        let sp = splitWithChunk(item.desc, input)

        for(let i in sp) {
          if(sp[i] == input) {
            let ele = document.createElement('span')
            ele.textContent = sp[i]
            ele.style = 'background-color: #918a3f; padding: 4px; border-radius: 5px'
            text.appendChild(ele)
          } else {
            let ele = document.createElement('span')
            ele.textContent = sp[i]
            ele.style = 'background-color: transparent; border-radius: 5px'
            text.appendChild(ele)
          }
        }
      } else {
        text.textContent = item.desc
      }
      text.innerHTML = " — " + text.innerHTML.toUpperCase()

      const section = document.createElement("em")

      if(item.desc.toLowerCase().includes(input) && input.length > 0) {
        let sp = splitWithChunk(item.system, input)

        for(let i in sp) {
          if(sp[i] == input) {
            let ele = document.createElement('span')
            ele.textContent = sp[i]
            ele.style = 'background-color: #918a3f; padding: 4px; border-radius: 5px'
            section.appendChild(ele)
          } else {
            let ele = document.createElement('span')
            ele.textContent = sp[i]
            ele.style = 'background-color: transparent; border-radius: 5px'
            section.appendChild(ele)
          }
        }
      } else {
        section.textContent = item.desc
      }

      //section.textContent = item.system
      section.style = "font-size: 12px"

      div.appendChild(strong);
      div.appendChild(text);
      div.appendChild(document.createElement('br'))
      div.appendChild(section)
      div.appendChild(document.createElement('br'))
      div.appendChild(document.createElement('br'))

      resultsDiv.appendChild(div);
      count++;
      if (count >= MAX_RESULTS) break;
    }
  }
}

function splitWithChunk(base, chunk) {
  let r = []
  let f = false
  let s = base.split('')
  let index = 0
  for(let i = 0; i < base.length - chunk.length + 1; i++) {
    let search = ''
    for(let u = 0; u < chunk.length; u++) {
      search += base[u + i]
    }
    if(chunk === search) {
      index = i
      break
    }
  }
  let t1 = base.slice(0, index)
  let t2 = base.slice(index + chunk.length)
  let arr = [t1, chunk, t2]

  for(let i in arr) {
    if(arr[i] != '') {
      r.push(arr[i])
    }
  }
  return r
}

var animation
function animate() {
  animation = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function exportJSON() {
  console.log(JSON.stringify(newPanels))
}

function openChecklist(type) {
  let wrapper = document.getElementById('checklists')
  let div = document.getElementById('checklist-items')
  let name = document.getElementById('cl-name')
  wrapper.style.display = 'block'

  let checklist = checklists[type]

  div.textContent = ""

  let res = checklists.names.find(obj => obj.obj_name === type)

  name.textContent = res.name

  for(let i in checklist) {
    let button = document.createElement('div')

    let label = document.createElement('label')
    label.setAttribute('class', 'option')

    let input = document.createElement('input')
    input.setAttribute('type', 'checkbox')
    input.setAttribute('class', 'cb')

    let span = document.createElement('span')
    span.textContent = checklist[i]

    label.appendChild(input)
    label.appendChild(span)

    button.appendChild(label)

    button.style="background-color: transparent; width: 100%; height 55px; font-size: 20px; margin: 0px"

    div.appendChild(button)
  }
}

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // stop automatic prompt
  deferredPrompt = e;
  console.log('Install prompt available');

  // Optionally show a custom "Install" button:
  const btn = document.createElement('button');
  btn.textContent = 'Install App';
  btn.onclick = () => {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choice) => {
      console.log('User choice:', choice.outcome);
      deferredPrompt = null;
    });
  };
  document.body.appendChild(btn);
});

function openForms(name) {
  let div = document.getElementById('forms')

  div.style.display = 'block'

  // Setup canvas with picture
  const img = new Image();
  const canvas = document.querySelector('#form-canvas')
  const ctx = canvas.getContext('2d')
  img.src = root + '/781a.png'; // Relative or absolute path

  let f = forms[name].job

  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    // Create the job info
    ctx.font = '40px Arial';
    ctx.fillStyle = 'red';

    // Draw filled text
    ctx.fillText(f.sym, 10, 75);

    ctx.font = '14px Arial';
    ctx.fillStyle = 'black';

    ctx.fillText(f.JCN, 50, 65);
    ctx.fillText(f.dateDisc, 155, 65);
    ctx.fillText(f.docNumber, 275, 65);
    ctx.fillText(f.WUC, 10, 105);
    ctx.fillText(f.fauCode, 140, 105);
    ctx.fillText(f.staCode, 240, 105);
    ctx.fillText(f.dateCorr, 570, 65);

    ctx.font = '12px Arial';
    let splitDisc = f.disc.split('\n')
    let u = 0

    splitDisc.forEach(function(i) {
      u ++
      ctx.fillText(i, 10, 170 + (u * 14));
    })

    ctx.font = '14px Arial';

    ctx.fillText(f.discBy, 20, 330);
    ctx.fillText(f.emNum, 220, 330);

    ctx.font = '12px Arial';
    let splitCorr = f.corrAct.split('\n')
    u = 0

    splitCorr.forEach(function(i) {
      u ++
      ctx.fillText(i, 350, 150 + (u * 14));
    })

    ctx.font = '14px Arial';
    ctx.fillText(f.corrBy, 350, 300);
    ctx.fillText(f.corrByEmNum, 560, 300);
    ctx.fillText(f.insBy, 350, 330);
    ctx.fillText(f.insByEmNum, 560, 330);

    ctx.font = '22px Arial';
    ctx.fillText(f.symOver, 15, 70);
  };
}

function openIMDS() {
  document.getElementById('IMDS').style.display = 'block'

  let buttons = document.getElementById('imds-buttons')

  buttons.textContent = ''
  console.log(notes)
  for(let i in notes) {
    let button = document.createElement('button')

    button.textContent = notes[i].name
    button.onclick = function() {
      let results = document.getElementById('imds-results')
      results.textContent = ''

      for(let u in notes[i].steps) {
        let p = document.createElement('p')

        p.textContent = notes[i].steps[u]

        results.appendChild(p)
      }
    }

    buttons.appendChild(button)
  }
}

function newTorque(originalTorque, angleDeg, extenderLength, wrenchLength = 10) {
  const angleRad = angleDeg * Math.PI / 180;
  return originalTorque * ((wrenchLength + extenderLength * Math.cos(angleRad)) / wrenchLength);
}

function torqueSubmit() {
  let twLength = document.getElementById('tw-length')
  let exLength = document.getElementById('ex-length')
  let originTorque = document.getElementById('origin-torque')
  let degS = document.getElementById('deg')
  let degA = [0, 45, 90, 135, 180, 225, 270, 315]
  let deg = degA[JSON.parse(degS.value)]

  document.getElementById('torqueRes').textContent = Math.round(newTorque(JSON.parse(originTorque.value), deg, JSON.parse(exLength.value), JSON.parse(twLength.value)))
}

function updateTorqueIn(deg) {
  let can = document.querySelector("#torqueCanvas")
  let ctx = can.getContext('2d')

  let width = window.innerWidth
  let height = window.innerHeight

  can.width = width * 0.8
  can.height = height * 0.25

  if(can.width > 300) {
    can.width = 300
  }

  let w = (num) => {
    return (can.width * 1.5) * (num / 100)
  }
  let h = (num) => {
    return can.height * (num / 100)
  }

  ctx.strokeStyle = '#258c00'
  ctx.lineWidth = 3

  // Handle
  ctx.strokeRect(0, h(50) - (h(40) / 2), w(20), h(40))
  ctx.strokeRect(w(20), h(50) - (h(30) / 2), w(20), h(30))

  ctx.beginPath();
  ctx.arc(w(20) + (w(20)), h(50) - (h(30) / 2) + (h(30) / 2), h(15), 0, 2 * Math.PI);
  ctx.fillStyle = '#151b1f'
  ctx.fill();

  ctx.beginPath();
  ctx.arc(w(20) + (w(20)), h(50) - (h(30) / 2) + (h(30) / 2), h(15), 0, 2 * Math.PI);
  ctx.stroke();

  let axis = [
    w(20) + (w(15)) + (w(10) / 2),
    h(50) - (h(30) / 2) + (h(15))
  ]
  // save current canvas state
  ctx.save();

  // move origin to your axis
  ctx.translate(axis[0], axis[1]);

  // rotate by degrees (convert to radians)
  ctx.rotate(deg * Math.PI / 180);

  // draw the rect *relative to new origin*
  ctx.fillRect(-w(5), -h(10), w(25), h(20));
  ctx.strokeRect(-w(5), -h(10), w(25), h(20));

  ctx.beginPath();
  ctx.arc(w(15), 0, h(7), 0, 2 * Math.PI);
  ctx.stroke();

  // restore so further drawing is unaffected
  ctx.restore();
}

window.setTimeout(function() {
  updateTorqueIn(0)

  let select = document.getElementById('deg')

  select.addEventListener('change', function() {
    let degA = [0, 45, 90, 135, 180, 225, 270, 315]
    let deg = degA[JSON.parse(document.getElementById('deg').value)]
    updateTorqueIn(deg)
  })
}, 100)


// ----- SECURITY ------
async function decryptAES(base64Data, password) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  try {
    const combined = base64ToBytes(base64Data);

    // Basic sanity checks (helps catch wrong file / truncated data)
    if (combined.length < 16 + 12 + 1) {
      return { ok: false, reason: "bad_format", error: "Too short" };
    }

    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const ciphertext = combined.slice(28);

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    // If password wrong OR data tampered/corrupted -> this throws
    const decryptedBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    const text = dec.decode(decryptedBuf);

    // If you expect JSON, parse it; JSON parse failure is NOT a crypto failure
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch {
      return { ok: true, value: text, warning: "not_json" };
    }
  } catch (err) {
    // AES-GCM failures (wrong password / tamper / corrupt) land here
    // In most browsers it's DOMException: OperationError
    return {
      ok: false,
      reason: "decrypt_failed",
      errorName: err?.name || "Error",
      errorMessage: err?.message || String(err)
    };
  }
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

