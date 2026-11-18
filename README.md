# 어디까지?

OpenStreetMap 장소 검색으로 출발지와 도착지를 확인하고, 운전 경로의 총거리를 보여주는 정적 웹앱입니다.

## 실행

프로젝트 폴더를 Vercel에 가져오면 별도 설정 없이 정적 웹앱으로 배포할 수 있습니다. 로컬에서는 정적 파일 서버로 `index.html`을 제공하세요. 빌드 명령, 서버리스 함수, Redis, API 키, 별도 환경변수가 필요하지 않습니다.

## 데이터 서비스

- 장소 검색: [Nominatim](https://nominatim.org/)
- 운전 경로: [OSRM 공개 데모 서버](https://router.project-osrm.org/)
- 지도: [OpenStreetMap](https://www.openstreetmap.org/)

경로 거리는 자동차 도로 기준이며, 실제 교통 상황이나 대중교통·도보 거리를 반영하지 않습니다. 앱은 검색어를 Nominatim에 보내고, 좌표를 OSRM에 전달합니다. 두 서비스와 지도 타일은 각 서비스의 이용 정책과 가용성에 따릅니다. Nominatim 공개 서버는 사용량 제한이 있으므로 대량 트래픽이 예상되는 서비스에는 적합한 별도 지오코딩 서비스를 사용해야 합니다.
