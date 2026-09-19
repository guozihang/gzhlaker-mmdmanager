window.store = new Vuex.Store({
  	state: {
		index : 0,
		search: "",
		tag: "",
		showPath: "",
		data : {},
		// path → { category, bookmarked, nsfw } index over data.json items,
		// kept in memory so filtering never re-reads the file (see _buildItemIndex)
		itemIndex : {},
		important: [],
		software: [],
		settings: {
			dataPath: '',
			defaultModelPath: '',
			mmdPath: '',
			preview: {
				ambientColor: '#666666',
				directionalColor: '#887766',
				showAxis: true,
				autoRotate: true,
				cameraFov: 45,
				dualModel: false
			}
		}
  	},
  	mutations: {
		index(state, value){state.index = value},
		search(state, value){state.search = value},
		tag(state, value){state.tag = value},
		showPath(state, value){state.showPath = value},
		data(state, value){state.data = value},
		important(state, value){state.important = value},
		software(state, value){state.software = value},
		settings(state, value){state.settings = value},
  	}
})