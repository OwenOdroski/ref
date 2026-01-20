// Get DB
let register = true
if ('serviceWorker' in navigator && register) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/ref/sw.js')
      .then(reg => {
        console.log('✅ Service Worker registered with scope:', reg.scope);
      })
      .catch(err => {
        console.error('❌ Service Worker registration failed:', err);
      });
  });
}

let allPanels
let forms
let ref
let notes
let checklists
fetch('/ref/db.json')
  .then(res => res.json())
  .then(data => {
    forms = data.forms
    allPanels = data.panels
    ref = data.to
    notes = data.notes
    checklists = data.checklists

    let ch = document.getElementById('ch')
    console.log(data)
    for(let curr of checklists.names) {
      let button = document.createElement('button')
      button.setAttribute('onclick', `openChecklist("${curr.obj_name}")`)
      button.innerHTML = curr.name
      ch.appendChild(button)
    }
    loadList()
  });


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

window.onload = function() {
  // Julian Date
  const julian = document.getElementById('julian')
  const date = new Date()
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  julian.innerHTML = "Julian Date: " + Math.floor(diff / oneDay);
}

function fuelQuan() {
  let total = document.getElementById('fuel-quantity')
  let selected = document.getElementById('config')
  let model = document.getElementById('model')
  let result = document.getElementById('fuel-result')

  let fullWeight = maxLoads.arr[JSON.parse(selected.value) - 1]

  if(model.value == "2") {
    fullWeight = fullWeight - 1250
  }

  result.innerHTML = '~<strong>' + Math.floor(((fullWeight - JSON.parse(total.value)) / 6.8) * 100) / 100 + '</strong>G (JP-8) <br><br> ~<strong>' + Math.floor(((fullWeight - JSON.parse(total.value)) / 6.4) * 100) / 100 + '</strong>G (JP-4)'
  result.style = "font-size: 20px"
}

// TO Ref search

//{name: "", MIDAS: "", TO: "", date: ""},

function loadList() { // Load refrences
  let list = document.getElementById('to-search-res')

  for(let i in ref) {
    let li = document.createElement('div')

    li.innerHTML = ref[i].name.toUpperCase()
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

    // const pmrem = new THREE.PMREMGenerator(renderer);
    // pmrem.compileEquirectangularShader();
    //
    // new THREE.RGBELoader()
    //   .setDataType(THREE.UnsignedByteType)
    //   .load('bg.hdr.png', function (texture) {
    //     const envMap = pmrem.fromEquirectangular(texture).texture;
    //     scene.environment = envMap;
    //     texture.dispose();
    //   });

    const loader = new THREE.GLTFLoader();
    loader.load('/ref/f16.glb', (gltf) => {
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
      s.innerHTML = percent + '% loaded'
      if(s.innerHTML == 'Infinity% loaded') {
        s.innerHTML = '100% loaded'
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
  }
  animate()

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

}

function closePanelScreen() {
  let canvas = document.getElementById('panel-3d')
  canvas.style.display = 'none'

  cancelAnimationFrame(animation)

  // Here I have to destroy the 3d model and clean up the scene


  let c = document.getElementById('panel-canvas')
  c.style.display = 'none'

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

  div.innerHTML = ""

  let res = checklists.names.find(obj => obj.obj_name === type)

  name.innerHTML = res.name

  for(let i in checklist) {
    let button = document.createElement('div')

    button.onclick = function() {
      button.style.background = '#FFFFFF'
    }
    button.innerHTML = `
    <label class="option">
      <input type="checkbox" class="cb">
      <span>${checklist[i]}</span>
    </label>
    `
    button.style="background-color: transparent; width: 100%; height 55px; font-size: 30px; margin: 0px"

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
  img.src = '/ref/781a.png'; // Relative or absolute path

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

  buttons.innerHTML = ''

  for(let i in notes) {
    let button = document.createElement('button')

    button.innerHTML = notes[i].name
    button.onclick = function() {
      let results = document.getElementById('imds-results')
      results.innerHTML = ''

      for(let u in notes[i].steps) {
        let p = document.createElement('p')

        p.innerHTML = notes[i].steps[u]

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

  document.getElementById('torqueRes').innerHTML = Math.round(newTorque(JSON.parse(originTorque.value), deg, JSON.parse(exLength.value), JSON.parse(twLength.value)))
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
  ctx.fillStyle = '#292929'
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
  console.log(select)

  select.addEventListener('change', function() {
    let degA = [0, 45, 90, 135, 180, 225, 270, 315]
    let deg = degA[JSON.parse(document.getElementById('deg').value)]
    updateTorqueIn(deg)
  })
}, 100)

