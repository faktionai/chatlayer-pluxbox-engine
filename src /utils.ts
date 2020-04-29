import dayjs from 'dayjs';
// @ts-ignore
import tz from 'dayjs-ext/plugin/timeZone';
import 'dayjs/locale/nl';

dayjs.locale('nl');
dayjs.extend(tz as dayjs.PluginFunc);

const timezone = 'Europe/Brussels';

const matchObject = (fields: any, defaultMust: any) =>
  Object.entries(fields).reduce(
    (result, [key, value]) => result.concat({ match: { [key]: value } }),
    defaultMust ? [defaultMust] : []
  );

interface ElasticSearchOptions {
  query?: any;
  sort?: string[];
  min_score?: number;
  filter?: any[];
  size?: number;
}

export const toElasticSearchQuery = (
  filterType: string,
  fields: any,
  { filter = [], query: { bool = {}, ...query } = {}, sort = [], size, ...rest }: ElasticSearchOptions | any = {}
) => ({
  size,
  query: {
    bool: { filter: filter.concat({ term: { _rmtype: filterType } }), ...bool, must: matchObject(fields, bool.must) },
    ...query,
  },
  sort,
  ...rest,
});

const createFormattedDate = (value: string) => {
  const date = dayjs(value);
  // @ts-ignore
  const fullDate = date.format('DD/MM/YYYY', { timeZone: timezone });
  // @ts-ignore
  const today = dayjs().format('DD/MM/YYYY', { timeZone: timezone });
  return {
    fullDate,
    // @ts-ignore
    time: date.format('HH:mm', { timeZone: timezone }),
    day: fullDate === today ? 'vandaag' : date.format('dddd'),
  };
};

export const extractElasticResult = ({ hits: { hits } = { hits: [] } }: any) =>
  hits.map(({ _id, _source: { field_values, presenters, start, stop, ..._source } }: any) => ({
    _id,
    ..._source,
    field_values,
    ...(presenters ? { presenters: presenters.map(({ name }: any) => name) } : {}),
    ...(start ? { start: createFormattedDate(start) } : {}),
    ...(stop ? { stop: createFormattedDate(stop) } : {}),
  }));
