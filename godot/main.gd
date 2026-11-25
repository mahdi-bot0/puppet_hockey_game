extends Node3D
# =====================================================================
#  SAROSH'S HOCKEY  (Godot version)
#  Step 1: a realistic arena + one player skating with the puck.
#
#  CONTROLS:  W A S D = skate   SHIFT = sprint   SPACE = shoot   R = reset puck
#
#  Everything is built with code in this one file, so it's easy to read.
#  Godot measures in METERS. A real NHL rink is 61 m long and 26 m wide.
# =====================================================================

# ----- 1. SETTINGS: numbers you can change! -----
const RINK_LENGTH := 60.96
const RINK_WIDTH := 25.9
const CORNER := 8.5             # how round the corners are
const BOARD_HEIGHT := 1.07
const GLASS_HEIGHT := 2.5
const GOAL_LINE := 26.8         # from center ice to each goal line
const BLUE_LINE := 7.6
const TEAM_JERSEY := Color("#00539b")   # blue
const TEAM_STRIPE := Color("#f47d30")   # orange
const SKATE_SPEED := 8.0        # meters per second
const SPRINT_SPEED := 10.5
const SHOT_SPEED := 30.0
const FANCY_LIGHTING := false   # bouncing light + reflections. Needs a gaming graphics card! (It crashed Sarosh's Mac.)

var player: Node3D              # the 3D person
var anim: AnimationPlayer
var puck: MeshInstance3D
var cam: Camera3D
var velocity := Vector3.ZERO
var puck_velocity := Vector3.ZERO
var has_puck := true
var stick_side := 0.0           # stickhandling: the puck goes side to side


func _ready() -> void:
	make_environment()
	make_lights()
	make_ice()
	make_boards()
	make_net(1)
	make_net(-1)
	make_crowd()
	make_player()
	make_puck()
	cam = Camera3D.new()
	cam.fov = 60
	add_child(cam)
	cam.position = Vector3(0, 4, 10)


# ----- 2. THE LOOK: lighting that bounces, reflections, glow, a film camera -----
func make_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#07090d")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#b8c6d8")
	env.ambient_light_energy = 0.7
	env.tonemap_mode = Environment.TONE_MAPPER_ACES        # movie-like colors
	env.tonemap_exposure = 1.0
	env.ssr_enabled = FANCY_LIGHTING                       # the ice reflects the players and boards!
	env.ssr_max_steps = 32
	env.ssao_enabled = FANCY_LIGHTING                      # soft dark shadows in corners
	env.ssil_enabled = FANCY_LIGHTING                      # light bounces off nearby things
	env.sdfgi_enabled = FANCY_LIGHTING                     # light bounces around the whole arena
	env.glow_enabled = true                                # bright lights glow
	env.glow_intensity = 0.6
	env.glow_bloom = 0.05
	env.fog_enabled = true                                 # a little haze high up, like a real arena
	env.fog_light_color = Color("#3b4252")
	env.fog_density = 0.004
	var world := WorldEnvironment.new()
	world.environment = env
	var cam_fx := CameraAttributesPractical.new()
	cam_fx.dof_blur_far_enabled = true                     # far away things are a bit blurry, like a TV camera
	cam_fx.dof_blur_far_distance = 45.0
	cam_fx.dof_blur_amount = 0.05
	world.camera_attributes = cam_fx
	add_child(world)


func make_lights() -> void:
	var sun := DirectionalLight3D.new()                    # the main roof lights
	sun.rotation_degrees = Vector3(-70, 25, 0)
	sun.light_energy = 0.9
	sun.light_color = Color("#fff6ea")
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 40.0
	add_child(sun)
	# rows of bright lamps over the ice
	for i in range(-2, 3):
		for j in [-1, 1]:
			var lamp := OmniLight3D.new()
			lamp.position = Vector3(j * 7.0, 14.0, i * 12.0)
			lamp.omni_range = 30.0
			lamp.light_energy = 0.5
			lamp.light_color = Color("#fff8ee")
			add_child(lamp)
			var bulb := MeshInstance3D.new()                # the glowing panel you can see
			var box := BoxMesh.new()
			box.size = Vector3(2.4, 0.2, 1.2)
			bulb.mesh = box
			var m := StandardMaterial3D.new()
			m.emission_enabled = true
			m.emission = Color("#fff6e0")
			m.emission_energy_multiplier = 6.0
			m.albedo_color = Color.WHITE
			bulb.material_override = m
			bulb.position = lamp.position + Vector3(0, 0.5, 0)
			bulb.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF   # (its shadow made gray boxes on the ice)
			add_child(bulb)


# ----- 3. THE ICE -----
# The outline of the rink: a rectangle with rounded corners
func rink_outline(grow: float, steps := 16) -> PackedVector2Array:
	var pts := PackedVector2Array()
	var hw := RINK_WIDTH / 2 + grow
	var hl := RINK_LENGTH / 2 + grow
	var r := CORNER + grow
	var centers := [Vector2(hw - r, hl - r), Vector2(-(hw - r), hl - r), Vector2(-(hw - r), -(hl - r)), Vector2(hw - r, -(hl - r))]
	for c in range(4):
		for s in range(steps + 1):
			var a := deg_to_rad(c * 90.0 + s * 90.0 / steps)
			pts.append(centers[c] + Vector2(cos(a), sin(a)) * r)
	return pts


func make_ice() -> void:
	# paint the lines on a picture (1 pixel = 2.5 cm)
	var px := 40.0
	var w := int(RINK_WIDTH * px)
	var h := int(RINK_LENGTH * px)
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	img.fill(Color("#dfe7ee"))
	var red := Color("#c8102e")
	var blue := Color("#0b3fa8")
	var to_px := func(x: float, z: float) -> Vector2: return Vector2((x + RINK_WIDTH / 2) * px, (z + RINK_LENGTH / 2) * px)
	var bar := func(z: float, thick: float, col: Color) -> void:
		var p: Vector2 = to_px.call(0, z)
		img.fill_rect(Rect2i(0, int(p.y - thick * px / 2), w, int(thick * px)), col)
	bar.call(0.0, 0.3, red)
	bar.call(BLUE_LINE, 0.3, blue)
	bar.call(-BLUE_LINE, 0.3, blue)
	bar.call(GOAL_LINE, 0.05, red)
	bar.call(-GOAL_LINE, 0.05, red)
	# circles: walk around the circle instead of checking every dot (much faster!)
	var ring := func(cx: float, cz: float, radius: float, thick: float, col: Color, filled: bool) -> void:
		var c: Vector2 = to_px.call(cx, cz)
		var rp := radius * px
		if filled:
			for r in range(int(rp) + 1):
				for i in range(int(TAU * maxi(r, 1)) + 1):
					var a := float(i) / float(maxi(r, 1))
					img.set_pixel(clampi(int(c.x + cos(a) * r), 0, w - 1), clampi(int(c.y + sin(a) * r), 0, h - 1), col)
		else:
			var half := int(max(1.0, thick * px / 2))
			for i in range(int(TAU * rp * 2)):
				var a := float(i) / (rp * 2)
				var p := Vector2(c.x + cos(a) * rp, c.y + sin(a) * rp)
				img.fill_rect(Rect2i(int(p.x) - half, int(p.y) - half, half * 2, half * 2), col)
	ring.call(0.0, 0.0, 4.57, 0.05, blue, false)
	ring.call(0.0, 0.0, 0.15, 0.0, blue, true)
	for end in [-1, 1]:
		for side in [-1, 1]:
			ring.call(side * 6.7, end * 20.1, 4.57, 0.05, red, false)
			ring.call(side * 6.7, end * 20.1, 0.3, 0.0, red, true)
			ring.call(side * 6.7, end * 6.1, 0.3, 0.0, red, true)
		ring.call(0.0, end * GOAL_LINE, 1.83, 0.05, Color("#8fcdf4"), true)   # goalie crease
	# skate scratches
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in range(1200):
		var p := Vector2(rng.randf() * w, rng.randf() * h)
		var a := rng.randf() * TAU
		for s in range(30):
			a += rng.randf_range(-0.08, 0.08)
			p += Vector2(cos(a), sin(a)) * 1.5
			if p.x > 0 and p.y > 0 and p.x < w and p.y < h:
				img.set_pixel(int(p.x), int(p.y), Color("#d3dde6"))
	img.generate_mipmaps()
	var tex := ImageTexture.create_from_image(img)

	# the ice shape (rounded rectangle), with the picture on top
	var outline := rink_outline(0.0)
	var tris := Geometry2D.triangulate_polygon(outline)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_normal(Vector3.UP)
	for i in tris:
		var p: Vector2 = outline[i]
		st.set_uv(Vector2((p.x + RINK_WIDTH / 2) / RINK_WIDTH, (p.y + RINK_LENGTH / 2) / RINK_LENGTH))
		st.add_vertex(Vector3(p.x, 0, p.y))
	var ice := MeshInstance3D.new()
	ice.mesh = st.commit()
	var m := StandardMaterial3D.new()
	m.albedo_texture = tex
	m.roughness = 0.08                 # very smooth = shiny
	m.metallic_specular = 0.5
	m.clearcoat_enabled = true         # a wet, glossy layer on top
	m.clearcoat = 1.0
	m.clearcoat_roughness = 0.03
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	ice.material_override = m
	add_child(ice)


# ----- 4. THE BOARDS AND GLASS -----
func wall(grow: float, bottom: float, top: float, thick: float, mat: Material) -> void:
	var pts := rink_outline(grow, 10)
	for i in range(pts.size()):
		var a := pts[i]
		var b := pts[(i + 1) % pts.size()]
		var mid := (a + b) / 2
		var seg := MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = Vector3(a.distance_to(b) + 0.05, top - bottom, thick)
		seg.mesh = box
		seg.material_override = mat
		seg.position = Vector3(mid.x, (top + bottom) / 2, mid.y)
		seg.rotation.y = -atan2(b.y - a.y, b.x - a.x)
		add_child(seg)


func make_boards() -> void:
	var white := StandardMaterial3D.new()
	white.albedo_color = Color("#f4f4ef")
	white.roughness = 0.3
	wall(0.1, 0.0, BOARD_HEIGHT, 0.2, white)
	var yellow := StandardMaterial3D.new()
	yellow.albedo_color = Color("#f2c230")
	yellow.roughness = 0.4
	wall(0.0, 0.0, 0.25, 0.02, yellow)
	var rail := StandardMaterial3D.new()
	rail.albedo_color = Color("#22262b")
	wall(0.1, BOARD_HEIGHT, BOARD_HEIGHT + 0.06, 0.26, rail)
	var glass := StandardMaterial3D.new()
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass.albedo_color = Color(0.85, 0.93, 0.97, 0.12)
	glass.roughness = 0.02
	glass.metallic_specular = 1.0
	wall(0.15, BOARD_HEIGHT + 0.06, GLASS_HEIGHT, 0.03, glass)


# ----- 5. THE NETS -----
func make_net(end: int) -> void:
	var g := Node3D.new()
	g.position = Vector3(0, 0, end * GOAL_LINE)
	if end < 0:
		g.rotation.y = PI
	add_child(g)
	var red := StandardMaterial3D.new()
	red.albedo_color = Color("#c8102e")
	red.metallic = 0.4
	red.roughness = 0.3
	var post := func(from: Vector3, to: Vector3) -> void:
		var p := MeshInstance3D.new()
		var c := CylinderMesh.new()
		c.top_radius = 0.03
		c.bottom_radius = 0.03
		c.height = from.distance_to(to)
		p.mesh = c
		p.material_override = red
		g.add_child(p)
		p.position = (from + to) / 2
		p.look_at_from_position(p.position, to, Vector3.FORWARD if abs((to - from).normalized().y) > 0.9 else Vector3.UP)
		p.rotate_object_local(Vector3.RIGHT, PI / 2)
	post.call(Vector3(-0.915, 0, 0), Vector3(-0.915, 1.22, 0))
	post.call(Vector3(0.915, 0, 0), Vector3(0.915, 1.22, 0))
	post.call(Vector3(-0.915, 1.22, 0), Vector3(0.915, 1.22, 0))
	# the white mesh: a see-through grid picture on the back, sides and top
	var img := Image.create(64, 64, false, Image.FORMAT_RGBA8)
	img.fill(Color(1, 1, 1, 0))
	img.fill_rect(Rect2i(0, 0, 64, 5), Color.WHITE)
	img.fill_rect(Rect2i(0, 0, 5, 64), Color.WHITE)
	var mesh_mat := StandardMaterial3D.new()
	mesh_mat.albedo_texture = ImageTexture.create_from_image(img)
	mesh_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	mesh_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mesh_mat.uv1_scale = Vector3(30, 18, 1)
	mesh_mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	var panel := func(size: Vector2, pos: Vector3, rot: Vector3) -> void:
		var q := MeshInstance3D.new()
		var plane := QuadMesh.new()
		plane.size = size
		q.mesh = plane
		q.material_override = mesh_mat
		q.position = pos
		q.rotation = rot
		g.add_child(q)
	panel.call(Vector2(1.83, 1.3), Vector3(0, 0.55, 1.0), Vector3(-0.35, 0, 0))   # back, leaning in
	panel.call(Vector2(1.0, 1.22), Vector3(-0.915, 0.61, 0.5), Vector3(0, PI / 2, 0))
	panel.call(Vector2(1.0, 1.22), Vector3(0.915, 0.61, 0.5), Vector3(0, PI / 2, 0))
	panel.call(Vector2(1.83, 0.45), Vector3(0, 1.22, 0.22), Vector3(-PI / 2, 0, 0))


# ----- 6. THE CROWD -----
func make_crowd() -> void:
	var img := Image.create(1024, 512, false, Image.FORMAT_RGBA8)
	img.fill(Color("#2a0f15"))
	var shirts := [Color("#00539b"), Color("#f47d30"), Color("#c8102e"), Color("#e8e8e8"), Color("#2b2b2b"), Color("#555b66"), Color("#f2c230")]
	var skins := [Color("#e8b896"), Color("#c99470"), Color("#9a6644"), Color("#5e3c24")]
	var rng := RandomNumberGenerator.new()
	rng.seed = 3
	for row in range(16):
		var y := row * 32
		img.fill_rect(Rect2i(0, y + 29, 1024, 3), Color("#140709"))
		var x := 2
		while x < 1010:
			if rng.randf() > 0.1:
				img.fill_rect(Rect2i(x, y + 16, 13, 13), shirts[rng.randi() % shirts.size()])
				img.fill_rect(Rect2i(x + 3, y + 7, 7, 8), skins[rng.randi() % skins.size()])
			x += 16 + rng.randi() % 4
	var tex := ImageTexture.create_from_image(img)
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = tex
	mat.emission_enabled = true
	mat.emission_texture = tex
	mat.emission_energy_multiplier = 0.25
	mat.roughness = 0.95
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.uv1_scale = Vector3(1, 1, 1)
	# sloped seating all the way around, made of tilted panels
	var pts := rink_outline(1.0, 6)
	for i in range(pts.size()):
		var a := pts[i]
		var b := pts[(i + 1) % pts.size()]
		var mid := (a + b) / 2
		var along := (b - a).normalized()
		var out := Vector2(along.y, -along.x)          # points away from the ice
		if out.dot(mid) < 0:
			out = -out
		var q := MeshInstance3D.new()
		var plane := QuadMesh.new()
		plane.size = Vector2(a.distance_to(b) + 0.1, 22.0)
		q.mesh = plane
		q.material_override = mat
		add_child(q)
		# lean the seats back, away from the ice, like real stands
		var x_axis := Vector3(along.x, 0, along.y)
		var up_axis := (Vector3(out.x, 0, out.y) * 0.82 + Vector3(0, 0.57, 0)).normalized()
		q.basis = Basis(x_axis, up_axis, x_axis.cross(up_axis))
		q.position = Vector3(mid.x + out.x * 10.0, GLASS_HEIGHT + 11.0 * 0.57, mid.y + out.y * 10.0)


# ----- 7. THE PLAYER (the real 3D person from Mixamo) -----
func make_player() -> void:
	var scene: PackedScene = load("res://models/player.glb")
	player = scene.instantiate()
	player.scale = Vector3.ONE * 0.01            # the model is in centimeters
	add_child(player)
	player.position = Vector3(0, 0.1, 10)
	# paint him in team colors
	for mesh in player.find_children("*", "MeshInstance3D", true, false):
		var mi := mesh as MeshInstance3D
		for s in range(mi.mesh.get_surface_count()):
			var original := mi.get_active_material(s)
			if original is StandardMaterial3D:
				var mat := original.duplicate() as StandardMaterial3D
				var part := String(mi.name)
				if part.contains("Shirt") or part.contains("Socks"):
					mat.albedo_color = TEAM_JERSEY
				if part.contains("Shorts"):
					mat.albedo_color = Color("#0a2a5c")
				mi.set_surface_override_material(s, mat)
	# play the breathing animation, on repeat
	var players := player.find_children("*", "AnimationPlayer", true, false)
	if players.size() > 0:
		anim = players[0]
		for anim_name in anim.get_animation_list():
			anim.get_animation(anim_name).loop_mode = Animation.LOOP_LINEAR
		if anim.has_animation("idle"):
			anim.play("idle")
	add_helmet()


# a helmet stuck to the head bone, so it moves with him
func add_helmet() -> void:
	var skels := player.find_children("*", "Skeleton3D", true, false)
	if skels.is_empty():
		return
	var skel := skels[0] as Skeleton3D
	var head_bone := -1
	for i in range(skel.get_bone_count()):
		if skel.get_bone_name(i).ends_with("Head"):
			head_bone = i
	if head_bone < 0:
		return
	var holder := BoneAttachment3D.new()
	holder.bone_name = skel.get_bone_name(head_bone)
	skel.add_child(holder)
	var helmet := MeshInstance3D.new()
	var dome := SphereMesh.new()
	dome.radius = 13.0                           # (centimeters, because the model is in centimeters)
	dome.height = 26.0
	dome.is_hemisphere = true
	helmet.mesh = dome
	var m := StandardMaterial3D.new()
	m.albedo_color = TEAM_JERSEY
	m.metallic = 0.2
	m.roughness = 0.15
	m.clearcoat_enabled = true
	helmet.material_override = m
	helmet.position = Vector3(0, 9.0, 1.0)
	helmet.scale = Vector3(1.0, 1.0, 1.15)
	holder.add_child(helmet)


func make_puck() -> void:
	puck = MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = 0.038
	c.bottom_radius = 0.038
	c.height = 0.025
	puck.mesh = c
	var m := StandardMaterial3D.new()
	m.albedo_color = Color("#0b0b0b")
	m.roughness = 0.35
	puck.material_override = m
	add_child(puck)


# ----- 8. EVERY FRAME: skate, stickhandle, shoot, camera -----
func _process(delta: float) -> void:
	# skating with W A S D (W = toward the far net)
	var input := Vector3.ZERO
	if Input.is_key_pressed(KEY_W): input.z -= 1
	if Input.is_key_pressed(KEY_S): input.z += 1
	if Input.is_key_pressed(KEY_A): input.x -= 1
	if Input.is_key_pressed(KEY_D): input.x += 1
	var top := SPRINT_SPEED if Input.is_key_pressed(KEY_SHIFT) else SKATE_SPEED
	var want := input.normalized() * top
	var grip := 2.5 if input != Vector3.ZERO else 0.6    # ice is slippery: you glide when you let go
	velocity = velocity.lerp(want, min(1.0, grip * delta))
	player.position += velocity * delta
	# stay inside the boards
	player.position.x = clamp(player.position.x, -RINK_WIDTH / 2 + 1, RINK_WIDTH / 2 - 1)
	player.position.z = clamp(player.position.z, -RINK_LENGTH / 2 + 1, RINK_LENGTH / 2 - 1)
	# face where you're skating, and lean forward when fast
	var speed := velocity.length()
	if speed > 0.5:
		var yaw := atan2(velocity.x, velocity.z)
		player.rotation.y = lerp_angle(player.rotation.y, yaw, min(1.0, 8.0 * delta))
	player.rotation.x = lerp(player.rotation.x, speed * 0.025, min(1.0, 5.0 * delta))
	player.position.y = 0.1 + sin(Time.get_ticks_msec() / 150.0) * 0.015 * min(1.0, speed / 4.0)

	# the puck
	var forward := Vector3(sin(player.rotation.y), 0, cos(player.rotation.y))
	var right := Vector3(forward.z, 0, -forward.x)
	if has_puck:
		stick_side = sin(Time.get_ticks_msec() / 200.0) * 0.25
		puck.position = player.position + forward * 0.9 + right * (0.3 + stick_side)
		puck.position.y = 0.0125
		if Input.is_key_pressed(KEY_SPACE):
			has_puck = false
			puck_velocity = forward * SHOT_SPEED + velocity
	else:
		puck.position += puck_velocity * delta
		puck_velocity *= exp(-0.3 * delta)
		if abs(puck.position.x) > RINK_WIDTH / 2 - 0.1:
			puck_velocity.x *= -0.7
			puck.position.x = sign(puck.position.x) * (RINK_WIDTH / 2 - 0.1)
		if abs(puck.position.z) > RINK_LENGTH / 2 - 0.1:
			puck_velocity.z *= -0.7
			puck.position.z = sign(puck.position.z) * (RINK_LENGTH / 2 - 0.1)
		# skate over to the puck to pick it up
		var blade := player.position + forward * 0.9
		if Vector2(blade.x - puck.position.x, blade.z - puck.position.z).length() < 0.6 and puck_velocity.length() < 15:
			has_puck = true
	if Input.is_key_pressed(KEY_R):
		has_puck = true

	# the camera follows behind and above
	var cam_want := player.position - forward * 6.5 + Vector3(0, 3.2, 0)
	cam.position = cam.position.lerp(cam_want, min(1.0, 3.0 * delta))
	cam.look_at(player.position + forward * 4 + Vector3(0, 1.0, 0))
