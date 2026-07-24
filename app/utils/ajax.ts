import { AxiosRequestConfig } from 'axios'

export const ajax = axios.create({
  timeout: 15 * 1000,
  headers: {
    'Content-Type': 'application/json',
  },
})
export const ajaxPostWithFormData = (
  url: string,
  data:
    string | string[][] | Record<string, string> | URLSearchParams | undefined,
  config?: AxiosRequestConfig
) =>
  ajax.post(url, new URLSearchParams(data).toString(), {
    ...config,
    headers: {
      ...config?.headers,
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
  })
