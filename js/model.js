window.store = new Vuex.Store({
  	state: {
		index : 0,
		search: "",
		tag: "",
		showPath: "",
		data : {},
		important: [],
		software: [],
		settings: getDefaultConfig().settings
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