// Get DB
let root = '.'
let register = true
let version = "4.1.1"

function isIphonePWA() {
  const isIOS = /iphone/i.test(navigator.userAgent);
  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  return isIOS && isStandalone && window.innerWidth < 600;
}

if ('serviceWorker' in navigator && register) {
  window.addEventListener('load', () => {
    const APP_VERSION = "1.0.0"
    const reg = navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`, {
      scope: "./",
      updateViaCache: "none",
    })

    //checkJSON()
  });
}

const DB_NAME = "AppDB";
const STORE_NAME = "jsonStore";
const DB_VERSION = 1;

let allPanels
let cockPanels
let forms
let ref
let notes
let checklists
let wuc
let decryptKey
let refDes
let devCockpit = []
let panelDesc
let phone
let userNotes
let DB
let systems
let components
let allowContolsUpdate = true

window.addEventListener("load", () => {
  let julian = document.getElementById('julian')
  let date = new Date()
  let start = new Date(date.getFullYear(), 0, 0);
  let diff = date - start;
  let oneDay = 1000 * 60 * 60 * 24;
  julian.textContent = "Julian Date: " + Math.floor(diff / oneDay);

  document.getElementById('app-version').innerHTML = "APP VERSION: " + version

  if(isIphonePWA()) {
    document.getElementById('spacer').style = 'height: 60px'
    const items = document.getElementsByClassName("x-button");

    for (let el of items) {
      el.style.marginTop = "50px"
    }
  } else {
    document.getElementById('spacer').style = 'height: 8px'
    const items = document.getElementsByClassName("x-button");

    for (let el of items) {
      el.style.marginTop = "8px";
    }
  }
})

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
// ✏️
async function checkJSON() {
  let a = await setupDB()
  let c = await hasJSON(a, 'json')
  let u = await hasJSON(a, 'user')
  let isWebAuthn = localStorage.getItem('isWebAuthn') // Shows if the user is using WebAuthn verification or not
  let clear = document.getElementById('clearIndexed')

  DB = a

  if(!u) {
    saveJSON(a, 'user', JSON.stringify({panelData: {}, notes: {}}))
  } else {
    let g = await getJSON(a, 'user')
    userNotes = JSON.parse(g)
  }

  clear.addEventListener('mousedown', async function() {
    if(confirm('Are you sure you want to delete your .ENC file?')) {
      await deleteJSON(a, 'json')
      alert('.ENC cleared')
      window.location.reload()
    }
  })

  if(!c) {
    document.getElementById('blur-back').style.display = 'block'

    let signupBox = document.getElementById('file-upload');
    let loginBox = document.getElementById('file-pass');
    let upload = document.getElementById('file')
    let form = document.getElementById('signup')

    signupBox.style.display = 'block'

    form.addEventListener("submit", async (e) => {
      const file = upload.files[0];
      if (!file) return;

      const data = new FormData(form)
      const user = data.get("username")
      const key = data.get("password")

      window.setTimeout(async function() {
        const text = await file.text();   // Read file as string
        const dec = await decryptAES(text, user + key)

        decryptKey = user + key

        isWebAuthn = document.getElementById('webAuthn').checked
        localStorage.setItem("isWebAuthn", isWebAuthn)

        if (!dec.ok) {
          if (dec.reason === "decrypt_failed") {
            alert("Wrong password or file corrupted/tampered.");
          } else {
            alert("Bad file format.");
          }
        } else {
          let d = new Date(dec.value.meta.els)
          let td = new Date()

          if(d < td) {
            alert("Encrypted file has expired")
            return
          }
          document.getElementById('load-message').style.display = 'block'
          document.getElementById('file-upload').style.opacity = '0'
          document.getElementById('file-upload').style.display = 'none'

          // Handle WebAuthn
          if(isWebAuthn) {
            await registerPasskey(user); // better to use username, not username+password

            const encryptedBlob = await encryptJsonWithPasskey(dec.value);

            await saveJSON(a, "json", JSON.stringify(encryptedBlob));
            await saveJSON(a, "authMode", "webauthn");

            loadPage(dec.value, true)
          } else {
            await saveJSON(a, "json", text);
            loadPage(a)
          }
        }
      }, 30)

      e.preventDefault()
    });
  } else {
    document.getElementById('blur-back').style.display = 'block'

    if(isWebAuthn != "true") {
      const signupBox = document.getElementById('file-upload');
      const loginBox = document.getElementById('file-pass');

      loginBox.style.display = 'block';

      async function l(reason = '', user, key) {
        let cn = await getJSON(a, 'json')
        decryptKey = user + key

        let content = await decryptAES(cn, decryptKey)
        let doc = document.getElementById('pass-error')

        if(!content.ok) {
          // Check if web authn was used before
          try {
            let isWeb = JSON.parse(cn)
            let auth = await decryptAES(isWeb.data, decryptKey)

            if(auth.errorMessage == "Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded.") {
              alert(".ENC not properly encoded. If you used WebAuthn before, a username and password will not work.")
              return
            }
            content = {value: auth}
          } catch {
            doc.innerHTML = "Error decrypting file"
            return
          }
        }
        let d = new Date(content.value.meta.els)
        let td = new Date()

        if(d < td) {
          doc.innerHTML = "Encrypted file has expired"
          deleteJSON(a, 'json')
          window.location.reload()
          return
        }
        document.getElementById('file-pass').style.opacity = '0'
        document.getElementById('file-pass').style.display = 'none'
        document.getElementById('blur-back').style.display = 'none'
        loadPage(a)

      }
      let login = document.getElementById('login')
      login.addEventListener("submit", (e) => {
        const data = new FormData(login)
        const user = data.get("username")
        const key = data.get("password")

        window.setTimeout(() => {
          l('', user, key)
        }, 30)

        e.preventDefault()
      })

    } else {
      // Handle sign in with WebAuthn
      try {
        let cn = await getJSON(a, 'json');
        let savedBlob = JSON.parse(cn);   // because you saved it as JSON string
        let dec = await decryptJsonWithPasskey(savedBlob);

        loadPage(dec, true)

        document.getElementById('file-pass').style.opacity = '0'
        document.getElementById('file-pass').style.display = 'none'
        document.getElementById('blur-back').style.display = 'none'
      } catch {
        alert('There was an error accessing WebAuthn')
        document.getElementById('blur-back').style.display = 'none'
      }
    }
  }
}
checkJSON()

async function loadPage(db, isWebAuthn) {
  let data
  if(!isWebAuthn) {
    let d = await getJSON(db, 'json')
    let d2 = await decryptAES(d, decryptKey)
    data = d2.value
  } else {
    data = db
  }

  if(data != null) {
    allPanels = data.system.panels
    ref = data.system.to
    wuc = data.system.WUC
    refDes = data.system.ref
    cockPanels = data.system.cpPanels
    panelDesc = data.system.panelData
    systems = data.system.ops
    components = data.system.components

    phone = data.local.db.phone
    notes = data.local.db.notes
    checklists = data.local.db.checklists

    // Load 3D model in the background
    startPanelScreen(true)

    document.getElementById('enc-version').innerHTML = "ENC VERSION: " + data.version

    document.getElementById('metadata').innerHTML =
      "LOGGED IN AS: " + data.meta.name.toUpperCase() + "<br>" +
      "EXPIRATION DATE: " + new Date(data.meta.els).toLocaleDateString("en-US") + "<br>" +
      "UNIT: " + data.meta.unit.toUpperCase()

    if(data.version != version) {
      document.getElementById('updateNotice').style.display = 'block'

      let splitENC = data.version.split('.')
      let splitV = version.split('.')
      let title = document.getElementById('ud-title')
      let body = document.getElementById('ud-text')

      //' → '

      if(splitENC[0] > splitV[0]) {
        title.textContent = 'An updated app is available'
        body.textContent = version + ' → ' + data.version
      } else if(splitENC[0] < splitV[0]) {
        title.textContent = 'An updated .ENC file is available'
        body.textContent = data.version + ' → ' + version
      } else {
        if(splitENC[1] > splitV[1]) {
          title.textContent = 'An updated app is available'
          body.textContent = version + ' → ' + data.version
        } else if(splitENC[1] < splitV[1]) {
          title.textContent = 'An updated .ENC file is available'
          body.textContent = data.version + ' → ' + version
        } else {
          if(splitENC[2] > splitV[2]) {
            title.textContent = 'An updated app is available'
            body.textContent = version + ' → ' + data.version
          } else if(splitENC[2] < splitV[2]) {
            title.textContent = 'An updated .ENC file is available'
            body.textContent = data.version + ' → ' + version
          }
        }
      }
    }

    document.querySelectorAll('.tohide').forEach(el => {
      el.style.display = 'block';
    });

    if(wuc == undefined) document.getElementById('WUCwrapper').style.display = 'none'
    if(refDes == undefined) document.getElementById('refDesWrapper').style.display = 'none'

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
    if(wuc != undefined) searchWUC()
    if(refDes != undefined) searchRefDes()
    searchPhoneNum()
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

  for(let i = 0; i < ref.length; i++) {
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

var scene, camera, renderer, controls, mesh, group, light, group2, stations

// Panel Lookup
let panels = allPanels
let newPanels = []

function startPanelScreen(hide) {
  let canvas = document.getElementById('panel-3d')
  let c = document.querySelector('#panel-canvas')
  let c2 = document.getElementById('panel-canvas')
  let w = document.getElementById('loader-wrapper')
  let s = document.getElementById('loader-status')
  let mode3 = 0
  let planeOpacity = 1
  if(!hide) {
    c2.style.display = 'block'
    canvas.style.display = 'block'
    w.style.display = 'block'
  }

  // Create scene, load 3d model, and setup orbit controls
  if(scene == undefined) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFFFFFF)
    camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: c });
    renderer.setSize(innerWidth, innerHeight);

    controls = new THREE.OrbitControls(camera, renderer.domElement);

    light = new THREE.AmbientLight(0xffffff, 2.2);
    scene.add(light);

    group = new THREE.Group()
    group2 = new THREE.Group()
    stations = new THREE.Group()
    comp = new THREE.Group()

    let positions = [ // Name, pos, rot
      ["9", new THREE.Vector3(5, 0, 47), 0],
      ["8", new THREE.Vector3(5, -3, 40), 0],
      ["7", new THREE.Vector3(5, -3, 30), 0],
      ["6", new THREE.Vector3(5, -3, 18), 0],

      ["5R", new THREE.Vector3(40, -8, 7), Math.PI / 4],
      ["5", new THREE.Vector3(10, -10, 0), 0],
      ["5L", new THREE.Vector3(40, -8, -7), Math.PI / 4],

      ["1", new THREE.Vector3(5, 0, -47), 0],
      ["2", new THREE.Vector3(5, -3, -40), 0],
      ["3", new THREE.Vector3(5, -3, -30), 0],
      ["4", new THREE.Vector3(5, -3, -18), 0],
    ]

    const loader = new THREE.GLTFLoader();
    const nocwrap = document.getElementById('noc-parts')

    for(let i = 0; i < components.length; i++) {
      if(components[i].type != 'noc') {
        const geometry = new THREE.Geometry();
        const modelData = components[i].modelData

        for(let v of modelData.vertices) {
          geometry.vertices.push(
            new THREE.Vector3(v[0], v[1], v[2])
          );
        }

        for(let f of modelData.faces) {
          geometry.faces.push(
            new THREE.Face3(f[0], f[1], f[2])
          );
        }

        geometry.computeFaceNormals();
        geometry.computeVertexNormals();

        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            color: 0x00ff00
          })
        );

        mesh.name = "x" + i;

        const t = modelData.transform;

        mesh.position.set(t.pos[0], t.pos[1], t.pos[2]);
        mesh.rotation.set(t.rot[0], t.rot[1], t.rot[2]);
        mesh.scale.set(t.scale[0], t.scale[1], t.scale[2]);

        comp.add(mesh)
      } else {
        // Optional equipment
        let wrap = document.createElement('div')
        let name = document.createElement('strong')
        let section = document.createElement('p')

        name.textContent = '(' + components[i].wuc + ') ' + components[i].nomen
        section.textContent = components[i].section

        section.style = 'margin-top: -3px'

        wrap.onclick = function() {
          // View info
          document.getElementById('comp-nomen').textContent = components[i].nomen
          document.getElementById('comp-pn').textContent = components[i].pNum
          document.getElementById('comp-system').textContent = components[i].section
          document.getElementById('comp-wuc').textContent = components[i].wuc
          document.getElementById('comp-to').textContent = components[i].ref
          document.getElementById('comp-descript').textContent = components[i].desc

          document.getElementById('comp-desc').style.display = 'block'
        }

        wrap.appendChild(name)
        wrap.appendChild(section)
        nocwrap.appendChild(wrap)
      }
    }
    comp.visible = false
    scene.add(comp)

    loader.load(root + '/cockpit.glb', (gltf) => {
      gltf.scene.position.set(0, -20, 200)
      gltf.scene.scale.set(8, 8, 8)
      gltf.scene.rotation.x = Math.PI / -2
      gltf.scene.rotation.z = Math.PI / -2
      gltf.scene.children[0].children[9].visible = false
      gltf.scene.visible = false
      group2.visible = false
      scene.add(gltf.scene)

      let button = document.getElementById('switch')
      let bar = document.getElementById('clearWrapper')

      // Force double sided
      gltf.scene.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          obj.material.side = THREE.DoubleSide;
        }
      });

      for(let i = 0; i < positions.length; i++) {
        let pos = positions[i][1]
        let width  = 40

        if(positions[i][0].length != 1) {
          width = 20
        }

        let mesh = new THREE.Mesh(
          new THREE.BoxGeometry(width, 5, 5),
          new THREE.MeshBasicMaterial({color: 0x00FF00, transparent: true, opacity: 0.5})
        )
        mesh.position.copy(pos)
        mesh.rotation.x = positions[i][2]
        mesh.name = positions[i][0]
        stations.add(mesh)
      }
      scene.add(stations)
      stations.visible = false

      let select = document.getElementById('selectors')
      let mode3d = 2

      function makeOpaque(mesh, val) {
        mesh.traverse((e) => {
          if(e.isMesh) {
            e.material.transparent = val != 1;
            e.material.opacity = val;
            e.material.depthWrite = true;
            e.material.depthTest = true;
            e.material.side = THREE.FrontSide;
          }
        })
      }

      select.addEventListener('change', (e) => {
        const convert = ["check", "check3", "check4"]
        const vis = [stations, group, comp]

        convert.forEach((e, i) => {
          let cb = document.getElementById(convert[i])
          vis[i].visible = cb.checked
          if(cb.checked) mode3d = i

          if(cb.checked && i == 2) {
            makeOpaque(mesh, 0.7)
            comp.visible = true
            document.getElementById('comp-search').style.display = 'block'
            document.getElementById('searchBarPanels').style.display = 'none'
          } else {
            makeOpaque(mesh, 1)
            comp.visible = false
            document.getElementById('comp-search').style.display = 'none'
            document.getElementById('searchBarPanels').style.display = 'block'
          }
        });
      })

      button.onclick = () => {
        if(mode3 == 0) {
          let pos = new THREE.Vector3(0 + 29, 0.5, 200)
          camera.position.copy(pos)
          camera.position.x -= 0.1
          controls.target.copy(pos)
          controls.enableZoom = false
          controls.rotateSpeed = 1
          bar.style.display = 'none'
          mode3 = 1
          button.textContent = 'Panel Chart'
          mesh.visible = false
          gltf.scene.visible = true
          group.visible = false
          stations.visible = false
          group2.visible = true
          comp.visible = false
        } else {
          camera.position.set(100, 60, 100)
          controls.target.set(0, 0, 0)
          controls.enableZoom = true
          controls.rotateSpeed = 1
          bar.style.display = 'inline'
          mode3 = 0
          button.textContent = 'Cockpit'
          mesh.visible = true
          gltf.scene.visible = false

          if(mode3d == 2) group.visible = true
          if(mode3d == 0) stations.visible = true
          if(mode3d == 3) comp.visible = true
          group2.visible = false
        }
      }
    }, (xhr) => {
      let percent = (xhr.loaded / xhr.total * 100)
      s.textContent = percent + '% loaded'
      if(s.textContent == 'Infinity% loaded') {
        s.textContent = '100% loaded'
      }
    },
    (error) => {
      console.log(error)
      alert('Error loading 3D cockpit model');
    })


    loader.load(root + '/f16.glb', (gltf) => {
      mesh = gltf.scene
      scene.add(gltf.scene)

      w.style.display = 'none'

      gltf.scene.children[0].children[0].children[0].children[5].visible = false
      gltf.scene.children[0].children[0].children[0].children[3].visible = false

      gltf.scene.traverse((child) => {
        if(child.type == 'Mesh') {
          child.material.metalness = 3
          child.material.side = THREE.DoubleSide;
        }
      })

      scene.add(group)
      group.name = 'plane'
    }, (xhr) => {
      let percent = (xhr.loaded / xhr.total * 100)
      s.textContent = percent + '% loaded'
      if(s.textContent == 'Infinity% loaded') {
        s.textContent = '100% loaded'
      }
    },
    (error) => {
      console.log(error)
      alert('Error loading 3D aircraft model');
    });

    // Load past points from localStorage
    let value = allPanels//JSON.parse(localStorage.getItem('panels'))

    for(let i = 0; i < value.length; i++) {
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
    for(let i = 0; i < cockPanels.length; i++) {
      let mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 15, 15),
        new THREE.MeshBasicMaterial({color: 0xFF0000})
      )
      mesh.name = i
      mesh.position.x = cockPanels[i].cords[0]
      mesh.position.y = cockPanels[i].cords[1]
      mesh.position.z = cockPanels[i].cords[2]
      group2.add(mesh)
    }
    scene.add(group2)

    camera.position.set(100, 60, 100);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const canvas3 = renderer.domElement;

    canvas3.addEventListener('click', (event) => {
      // Convert screen coordinates to NDC
      pointer.x = (event.clientX / canvas3.clientWidth) * 2 - 1;
      pointer.y = -(event.clientY / canvas3.clientHeight) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      //mode = 'dev'

      // Replace `targetMesh` with the mesh you want to test against
      if(mode == 'dev') {
        const intersects = raycaster.intersectObject(scene, true);

        if (intersects.length > 0) {
          if(mode3 == 0) {
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
          } else if(mode3 == 1 || mode3 == 2) {
            let pr = prompt("Name? ")

            if(pr != null || pr.length != 0 || pr != undefined) {
              // Add that ball
              let point = intersects[0].point;

              let hit = intersects[0];
              let vec = hit.point

              let mesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 15, 15),
                new THREE.MeshBasicMaterial({color: 0xFF0000})
              )
              mesh.position.x = vec.x
              mesh.position.y = vec.y
              mesh.position.z = vec.z
              scene.add(mesh)

              devCockpit.push({cords: [vec.x, vec.y, vec.z], title: pr})
            }
          }
        }
      } else if(mode == 'view') {
        if(mode3 == 0) {
          let intersects = raycaster.intersectObject(group, true);

          if(group.visible) {
            if(intersects.length > 0) {
              let panel = allPanels[intersects[0].object.name]
              let fm = (content, nothing) => {
                if(content == undefined && nothing) {
                  return ""
                } else if(content == undefined && !nothing) {
                  return "Not Available"
                }
                return content
              }
              document.getElementById('gen-popup').style.display = "block"
              document.getElementById('blur-back').style.display = "block"
              document.getElementById('gen-data').textContent = panel.type + ' Number: ' + panel.number
              // Include TO Reference
              document.getElementById('gen-ref').textContent = "TO Reference: " + fm(panel.ref, false)
              document.getElementById('gen-fastener').textContent = "Fastener P/N: " + fm(panel.fast, false)
              document.getElementById('gen-desc').textContent = fm(panel.desc, true)
            }
          }
          if(stations.visible) {
            intersects = raycaster.intersectObject(stations, true);
            if(intersects.length > 0) {
              let name = intersects[0].object.name
              alert("STATION NUMBER: " + name)
            }
          }
          if(comp.visible) {
            let objects = raycaster.intersectObject(comp, true)

            if(objects.length !== 0 && objects[0].object.name[0] == "x") {
              let index = objects[0].object.name.slice(1)
              let data = components[index]
              let nomen = document.getElementById('comp-nomen') // From WUC
              let system = document.getElementById('comp-system')
              let WUC = document.getElementById('comp-wuc')
              let to = document.getElementById('comp-to')
              let pn = document.getElementById('comp-pn')
              let desc = document.getElementById('comp-descript')
              let related = document.getElementById('comp-related')

              document.getElementById('comp-desc').style.display = 'block'

              to.textContent = data.to
              desc.textContent = data.desc

              if(!data.desc) {
                desc.textContent = 'No description'
              }

              if(data.section == undefined || data.section == "-- Select System --") {
                system.textContent = "General"
              } else {
                system.textContent = data.section
              }

              if(data.pn == '' || data.pn == undefined) {
                pn.textContent = "Not Found"
              } else {
                pn.textContent = data.pn.toUpperCase()
              }
              WUC.textContent = formatWUC(data.WUC)

              for(let i = 0; i < wuc.length; i++) {
                if(formatWUC(wuc[i].code) == formatWUC(data.WUC)) {
                  nomen.textContent = wuc[i].desc + "\n" + wuc[i].system
                  break
                }
              }
              if(nomen.textContent.length < 3) {
                nomen.textContent = 'Not Found'
              }

              // Related Comps
              related.innerHTML = "<br>"
              if(data.related.length == 0) {
                let none = document.createElement('p')
                none.textContent = 'No Related Components'
                related.appendChild(none)
              }
              for(let x = 0; x < data.related.length; x++) {
                let curr = data.related[x]
                let option = document.createElement('details')
                let summary = document.createElement('summary')
                let nomen = document.createElement('p')
                let to = document.createElement('p')
                let wuc = document.createElement('p')
                let pNum = document.createElement('p')
                let desc = document.createElement('p')

                let makeLabel = (name, element) => {
                  let strong = document.createElement('strong')
                  strong.textContent = name

                  element.prepend(document.createElement('br'))
                  element.prepend(strong)
                  element.prepend(document.createElement('br'))
                  option.appendChild(element)
                }

                summary.textContent = curr.nomen
                nomen.textContent = curr.nomen
                to.textContent = curr.ref
                wuc.textContent = formatWUC(curr.wuc)
                pNum.textContent = curr.pNum.toUpperCase()
                desc.textContent = curr.desc

                option.style = "padding-left: 16px"

                if(!curr.desc) {
                  desc.textContent = "No description"
                }

                option.appendChild(summary)

                makeLabel("Nomenclature", nomen)
                makeLabel("TO Reference", to)
                makeLabel("WUC", wuc)
                makeLabel("Part Number", pNum)
                makeLabel("Description", desc)
                related.appendChild(option)
              }
            }
          }
        } else  {
          let intersects = raycaster.intersectObject(group2, true);

          if(intersects.length > 0) {
            let format = (val) => { return Math.floor(val * 100) }
            let panel = cockPanels[intersects[0].object.name]
            document.getElementById('desccp').textContent = ''
            if(panel != undefined) {
              let wrapper = document.getElementById('cockpit-desc')
              let ident = format(panel.cords[0]) + '/' + format(panel.cords[1]) + '/' + format(panel.cords[2])

              wrapper.style.display = 'block'

              document.getElementById('cpName').style = 'color: black'
              document.getElementById('cpName').textContent = panel.title.toUpperCase()
              document.getElementById('note-box').value = ''
              document.getElementById('ident').style = 'color: black; font-size: 13px; margin-top: -16px'
              document.getElementById('ident').textContent = ident

              let note = document.getElementById('cockpit-note')

              let retry = () => {
                let desc = document.getElementById('cpDesc')
                desc.innerHTML = ''

                if(userNotes != undefined && userNotes.panelData[intersects[0].object.name] != undefined && userNotes.panelData[intersects[0].object.name] != '') {
                  panelDesc[ident].push({type: "tab", name: "notes", data: userNotes.panelData[intersects[0].object.name]})
                }

                for(let i = 0; i < panelDesc[ident].length; i++) {
                  let curr = panelDesc[ident][i]

                  if(curr.type == 'tab') {
                    let d = document.createElement('details')
                    let s = document.createElement('summary')
                    let p = document.createElement('p')

                    s.textContent = curr.name.toUpperCase()
                    p.textContent = curr.data.replace(/\n/g, "\n\n")

                    s.style = 'color: black; font-size: 25px'
                    p.style = "color: black"

                    d.appendChild(s)
                    d.appendChild(p)
                    desc.appendChild(d)
                  } else {
                    let d = document.getElementById('desccp')

                    d.style = 'color: black'
                    d.textContent = curr.data
                  }
                }
              }
              retry()

              note.onclick = function() {
                if(userNotes != undefined && userNotes.panelData[intersects[0].object.name] != undefined) {
                  document.getElementById('note-box').value = userNotes.panelData[intersects[0].object.name]
                }

                document.getElementById('note-wrapper').style.display = 'block'

                document.getElementById('save-note').onclick = function() {
                  let val = document.getElementById('note-box')

                  userNotes.panelData[intersects[0].object.name] = val.value
                  saveJSON(DB, 'user', JSON.stringify(userNotes))
                  document.getElementById('note-wrapper').style.display = 'none'

                  if(panelDesc[ident][panelDesc[ident].length - 1].name == 'notes') {
                    panelDesc[ident].pop()
                  }
                  retry()
                }
              }
            }
          }
        }
      }
    });
  } else {
    s.style.display = 'none'
  }
  animate()
}

function formatWUC(text) {
  return text.slice(0, 5).toUpperCase()
}

window.addEventListener('load', function() {
  let inpComp = document.getElementById('searchComp')
  let resComp = document.getElementById('compRes')

  function searchComp() {
    console.log('s')
    resComp.style.display = 'block'
    document.getElementById('compBack').style.display = 'block'
    resComp.innerHTML = ''

    let push = (data, name, related, index, straight) => {
      let wrapper = document.createElement('div')
      let title = document.createElement('p')
      let system = document.createElement('p')

      if(!related) {
        title.textContent = "(" + data.WUC.toUpperCase() + ") " + name
        system.textContent = data.section
      } else {
        title.textContent = "(" + data.wuc.toUpperCase() + ") " + data.nomen
        system.textContent = name.section
      }

      title.style = "font-weight: bold; margin: -3px"
      system.style = "margin: -3px"
      wrapper.style = "margin-top: 32px"

      wrapper.onclick = function() {
        // Clear Everything except this component
        if(!straight) {
          resComp.style.display = 'none'
          document.getElementById('compBack').style.display = 'none'
          for(let i = 0; i < comp.children.length; i++) {
            if(comp.children[i].name.replace('x', '') != index) {
              comp.children[i].visible = false
            } else {
              controls.target.set(components[index].modelData.transform.pos[0], components[index].modelData.transform.pos[1], components[index].modelData.transform.pos[2])
              camera.position.set(components[index].modelData.transform.pos[0] + 5, components[index].modelData.transform.pos[1] + 5, components[index].modelData.transform.pos[2] + 5)
              controls.update()
            }
          }
        } else {

        }
      }

      wrapper.appendChild(title)
      wrapper.appendChild(system)
      resComp.appendChild(wrapper)
    }

    for(let i = 0; i < components.length; i++) {
      if(components[i].type != 'noc') {
        for(let u = 0; u < wuc.length; u++) {
          if(formatWUC(wuc[u].code).toUpperCase() == components[i].WUC.toUpperCase()) {
            if(wuc[u].desc.toUpperCase().includes(inpComp.value.toUpperCase()) || wuc[u].code.toUpperCase().includes(inpComp.value.toUpperCase())) {
              push(components[i], wuc[u].desc, false, i)
              break
            }
          }
        }
        for(let u = 0; u < components[i].related.length; u++) {
          if(components[i].related[u].nomen.toUpperCase().includes(inpComp.value.toUpperCase()) || components[i].related[u].wuc.toUpperCase().includes(inpComp.value.toUpperCase())) {
            push(components[i].related[u], components[i], true, i)
          }
        }
      } else {
        push(components[i], components[i], true, i, true)
      }
    }
  }

  inpComp.addEventListener('focus', (e) => {
    searchComp()
  })
  inpComp.addEventListener('focus', searchComp)
  inpComp.addEventListener('input', searchComp)
})

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

  document.getElementById('cuns-res').textContent = 'MAX CONSUMPTION: ~' + Math.floor(consumption * 10) / 10 + ' hpt(s)'
}
function openLegal() {
  document.getElementById('legal').style.display = 'block'
}

function searchPanel() {
  let search = document.getElementById('searchPanel')

  for(let i = 0; i < allPanels.length; i++) {
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

  for(let i = 0; i < consoleOutput.length; i++) {
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
      let text = document.createTextNode("WUC: " + refDes[i].wuc + " — Ref Des: " + refDes[i].ref)

      div.appendChild(text)
      div.appendChild(document.createElement('br'))
      output.appendChild(div)

      max -= 1
      if(max <= 0) break
    }
  }
}

function addHighlighted(parent, value, input) {
  const text = String(value || "");
  const lower = text.toLowerCase();
  const search = input.toLowerCase();

  if(!search || !lower.includes(search)) {
    parent.textContent = text.toUpperCase();
    return;
  }

  let i = 0;

  while(i < text.length) {
    const found = lower.indexOf(search, i);

    if(found === -1) {
      parent.appendChild(
        document.createTextNode(text.slice(i).toUpperCase())
      );
      break;
    }

    parent.appendChild(
      document.createTextNode(text.slice(i, found).toUpperCase())
    );

    const mark = document.createElement("span");
    mark.textContent = text.slice(found, found + search.length).toUpperCase();
    mark.style = "padding: 4px; border-radius: 5px; background-color: #918a3f; color: inherit; display: inline; position: static; float: none;"

    parent.appendChild(mark);

    i = found + search.length;
  }
}

function searchWUC() {
  const input = document.getElementById("searchWUC").value.trim().toLowerCase();
  const resultsDiv = document.getElementById("wuc-search-res");

  resultsDiv.innerHTML = "";

  if(input.length === 0) {
    const defaults = wuc.slice(0, 15);

    for(const item of defaults) {
      const div = document.createElement("div");

      div.innerHTML = `
        <strong>${item.code}</strong>
        — ${item.desc.toUpperCase()}
        <br>
        <em style="font-size:12px">
          ${item.system.toUpperCase()}
        </em>
        <br><br>
      `;

      resultsDiv.appendChild(div);
    }
    return;
  }

  let count = 0;
  const MAX_RESULTS = 75;

  for(const item of wuc) {
    const code = String(item.code || "");
    const desc = String(item.desc || "");
    const system = String(item.system || "");

    const match =
      code.toLowerCase().includes(input) ||
      desc.toLowerCase().includes(input) ||
      system.toLowerCase().includes(input);

    if(!match) continue;

    const div = document.createElement("div");

    const strong = document.createElement("strong");
    addHighlighted(strong, code, input);

    const text = document.createElement("span");
    text.appendChild(document.createTextNode(" — "));
    addHighlighted(text, desc, input);

    const section = document.createElement("em");
    section.style.fontSize = "12px";
    addHighlighted(section, system, input);

    div.appendChild(strong);
    div.appendChild(text);
    div.appendChild(document.createElement("br"));
    div.appendChild(section);
    div.appendChild(document.createElement("br"));
    div.appendChild(document.createElement("br"));

    resultsDiv.appendChild(div);

    count++;
    if(count >= MAX_RESULTS) break;
  }

  if(count === 0) {
    resultsDiv.textContent = "No WUC results found";
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

  for(let i = 0; i < arr.length; i++) {
    if(arr[i] != '') {
      r.push(arr[i])
    }
  }
  return r
}

var animation
function animate() {
  animation = requestAnimationFrame(animate);
  if(allowContolsUpdate) controls.update();
  renderer.render(scene, camera);
}

function exportJSON() {
  console.log(JSON.stringify(newPanels))
  console.log(JSON.stringify(devCockpit))
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

  for(let i = 0; i < checklist.length; i++) {
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

function searchPhoneNum() {
  let inp = document.getElementById("searchPhone").value.toUpperCase()
  let parent = document.getElementById("phoneSearchBar")

  parent.innerHTML = ''
  for(let i = 0; i < phone.length; i++) {
    let name = phone[i].name
    let ext = phone[i].extension
    let ss = phone[i].subsection

    if(name.toUpperCase().includes(inp) || ext.toUpperCase().includes(inp) || ss.toUpperCase().includes(inp)) {
      let wrapper = document.createElement('div')
      let body = document.createElement("p")
      let shop = document.createElement("p")

      body.textContent = name + ' — ' + ext
      shop.textContent = ss

      body.style = 'font-size: 16px; margin-bottom: 0px; margin-top: 0px'
      shop.style = "font-size: 14px; margin-top: 0px;"

      wrapper.addEventListener('mousedown', () => {
        if(ext.split('/').length != 1) {
          document.getElementById('blur-back').style.display = 'block'
          document.getElementById('ext-ask').style.display = 'block'

          document.getElementById('blur-back').onclick = function() {
            document.getElementById('blur-back').style.display = 'none'
            document.getElementById('ext-ask').style.display = 'none'
          }

          let wrapper = document.getElementById('ext')
          let exts = ext.split('/')

          wrapper.innerHTML = ''
          for(let i = 0; i < exts.length; i++) {
            let button = document.createElement('button')

            button.textContent = exts[i]
            button.onclick = function() {
              document.getElementById('blur-back').style.display = 'none'
              document.getElementById('ext-ask').style.display = 'none'
              window.location.href='tel:2604783' + exts[i]

              document.getElementById('blur-back').onclick = ''
            }

            wrapper.appendChild(button)
          }
        } else {
          window.location.href='tel:2604783' + ext
        }
      })

      wrapper.appendChild(body)
      wrapper.appendChild(shop)
      parent.appendChild(wrapper)
    }
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

async function clearAppStorage({ reload = true } = {}) {
  // Delete all Cache Storage entries
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  }

  // Delete all IndexedDB databases
  if ("indexedDB" in window && indexedDB.databases) {
    const dbs = await indexedDB.databases();
    await Promise.all(
      dbs.map(db => {
        return new Promise(resolve => {
          const req = indexedDB.deleteDatabase(db.name);
          req.onsuccess = req.onerror = req.onblocked = () => resolve();
        });
      })
    );
  }

  console.log("Caches and IndexedDB cleared.");

  if (reload) {
    location.reload();
  }
}

function convert(text) {
  // Converts text into HTML
  let open = ["<b>", "<i>", "<u>"]
  let close = ["</b>", "</i>", "</u>"]
  let detOpen = ["s//", "i//", "u//"]
  let detClose = ["//s", "//i", "//u"]
  let output = text.replaceAll(/\n/g, '<div style="height: 15px"></div>')

  for(let i = 0; i < open.length; i++) {
    output = output.replaceAll(detClose[i], close[i]) // Close
    output = output.replaceAll(detOpen[i], open[i]) // Open
  }

  return output
}

function openSystems() {
  document.getElementById('systems-wrapper').style.display = 'block'

  let openSys = (name) => {
    let con = {
      ele: "Electrical Systems",
      env: "Enviromental Systems",
      hyd: "Hydraulic Systems",
      fuel: "Fuel Systems",
      eng: "Engine Systems",
    }

    // Opens the file from the enc file, parses into HTML, then HTML
    if(systems[name] != undefined) {
      let sys = systems[name]
      document.getElementById('sys-popup').style.display = 'block'
      document.getElementById('sys-tab').innerHTML = ''

      for(let i = 0; i < sys.length; i++) {
        if(sys[i].type == 'top') {
          document.getElementById('sys-name').textContent = con[name]
          document.getElementById('sys-too').innerHTML = convert(sys[i].data)
        } else if(sys[i].type == 'tab') {
          if(sys[i].name != '') {
            let d = document.createElement('details')
            let s = document.createElement('summary')
            let p = document.createElement('p')

            s.textContent = sys[i].name.toUpperCase()
            p.innerHTML = convert(sys[i].data)

            s.style = 'color: black; font-size: 25px'
            p.style = "color: black"

            d.appendChild(s)
            d.appendChild(p)
            document.getElementById('sys-tab').appendChild(d)
          }
        }
      }
    } else {
      alert('There was an error loading this page.')
    }
  }
  let cn = ['sys-ele', 'sys-env', 'sys-hyd', 'sys-fuel', 'sys-eng', 'sys-brake']
  let con = {
    ele: "Electrical Systems",
    env: "Enviromental Systems",
    hyd: "Hydraulic Systems",
    fuel: "Fuel Systems",
    eng: "Engine Systems",
  }
  let wrapper = document.getElementById('theory-wrapper')
  let len = 0

  if(systems == undefined) {
    let p = document.createElement('p')
    p.innerHTML = 'You have no systems data or it failed to load. Maybe update .ENC?'
    wrapper.appendChild(p)
    return
  }

  wrapper.innerHTML = ''
  for(let i = 0; i < cn.length; i++) {
    let name = cn[i].slice(4, 10)
    let text = con[name]

    if(systems[name] != undefined) {
      len += 1
      let button = document.createElement('button')

      button.textContent = text
      button.onclick = function() {
        openSys(name)
      }

      wrapper.appendChild(button)
      wrapper.appendChild(document.createElement('br'))
    }
  }
}

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

  for(let i = 0; i < notes.length; i++) {
    let button = document.createElement('button')

    button.textContent = notes[i].name
    button.onclick = function() {
      let results = document.getElementById('imds-results')
      results.textContent = ''

      for(let u = 0; u < notes[i].steps.length; u++) {
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
