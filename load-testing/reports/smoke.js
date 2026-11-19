import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  iterations: 3,
};

export default function () {
  const response = http.get('https://test.k6.io');

  check(response, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}