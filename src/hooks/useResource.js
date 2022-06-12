import { useStore } from "vuex";
import { ref,  computed, onUnmounted } from 'vue'
import localforage from "localforage";
import {RESOURCE_CACHE_MODULE,RESOURCE_CACHE_DELETE,RESOURCE_CACHE_SAVE,LOAD_ALL_PERSISTENCE_DATA} from "../utils/store.key";


export const PERSISTENCE_DATA_KEYS = [
  getRealKey('temp', 'fackApi'),
]

export const resourceModule = {
  name: RESOURCE_CACHE_MODULE,
  state:()=>{
    return {
      [RESOURCE_CACHE_MODULE]:{}
    }
  },
  mutations:{
    [RESOURCE_CACHE_DELETE]: (state, payload)=>{
      if(payload.realKey) return;
      state[RESOURCE_CACHE_MODULE][payload.realKey] = null;
    },
    [RESOURCE_CACHE_SAVE]: (state, payload)=>{
      const { realKey, data, isPersistence} = payload ||{};
      if(!realKey) return;
      state[RESOURCE_CACHE_MODULE][realKey] = data;
      if(isPersistence) {
        localforage.setItem(realKey, data);
      }
    },
  },
  actions:{
    // 加载所有持久化数据
    [LOAD_ALL_PERSISTENCE_DATA]: async (context)=>{
      PERSISTENCE_DATA_KEYS.forEach(async (realKey)=>{
        const realValue = await localforage.getItem(realKey);
        context.commit(RESOURCE_CACHE_SAVE,{
          realKey, data:realValue,
        })
      })
    }
  }
}

/**
 * 加载所有持久化的数据
 * @param {import('vuex').Store} store VuexStore
 */
export function loadAllPersistenceData(store) {
  store.dispatch(LOAD_ALL_PERSISTENCE_DATA);
}

function getRealKey(key, serviceName) {
  return key+'@—resource-hook—@'+serviceName;
}

function getCache(store, realKey) {
  const cacheValue = store.state?.[RESOURCE_CACHE_MODULE]?.[RESOURCE_CACHE_MODULE]?.[realKey];

  return cacheValue;
}

function deleteCache(store, realKey) {
  store.dispatch(RESOURCE_CACHE_DELETE, {
    realKey,
  });
}

function setCache(store, realKey, data, isPersistence) {
  store.commit(RESOURCE_CACHE_SAVE, {
    realKey,
    data,
    isPersistence
  })
}

function createPagerParams(params) {
  if(!params?.page){
    console.warn("can not find page params!");
    return params;
  }

  const {page} = params;
  return {...params, page:page+1 }
}

function mergePageData(old, newData) {
  return [...old, ...newData];
}

/**
 * @typedef {Object} ResourceDef
 * @property {bool} loading 请求是否结束
 * @property {import('vue').ComputedRef} data 请求结束
 * @property {Error} err 请求错误
 * @property {Function} reLoading 重新请求
 * @property {Function} setData 设置数据
 * @property {Function} loadMore 加载下一页
 */

/**
 * 缓存值请求
 * @param {String} key 缓存key
 * @param {Function} service 返回值为Promise的接口
 * @param {Object} options 配置项
 * @param {Boolean} options.cleanAfter 组件卸载后清除数据
 * @param {Boolean} options.noFatch 不直接进行请求
 * @returns {ResourceDef}
 */
export function useResource(key, service, params, options={cleanAfter:false, noFatch:false}){
  const realKey = getRealKey(key, service.name);
  const store = useStore();
  let resultValue = computed(()=>getCache(store, realKey));
  let error = ref(null);
  let loading = ref(false);

  const isPersistence = PERSISTENCE_DATA_KEYS.find((key)=>key===realKey);

  const fetchData = async (realParams)=>{
    loading.value = true;
    try {
      const data = await service(realParams);
      return data;
    } catch (err) {
      error.value = err;
    } finally {
      loading.value = false;
    }
    return null;
  }

  const reLoading = async (reloadParams=params)=>{
    const data = await fetchData(reloadParams);
    setCache(store, realKey, data, isPersistence);
  }

  const setData = (newData)=>{
    setCache(store, realKey, newData, isPersistence);
  }

  const loadMore = async (reloadParams=params, merge=mergePageData)=>{
    const data = await fetchData(createPagerParams(reloadParams));
    setCache(store, realKey, merge(resultValue, data), isPersistence);
  }

  if((!resultValue.value)&&!options.noFatch) {
    reLoading();
  }

  if(options.cleanAfter) {
    onUnmounted(()=>{
      deleteCache(store, realKey);
    })
  }

  return {
    loading,
    data: resultValue,
    err: error,
    reLoading,
    setData,
    loadMore
  }
}