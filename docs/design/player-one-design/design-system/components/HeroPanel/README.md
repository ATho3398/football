# HeroPanel

화면 맨 위의 라임 히어로 헤더. 그 화면의 대표 숫자 하나를 아주 크게 보여 준다(덱 수, 남은 포인트, 시즌 순위 등).

- 소비자가 넣는 것: `title`(가운데 제목), `right`(오른쪽 짧은 정보, 예: "12주차"), `onBack`(false면 뒤로 버튼 없음), `eyebrow`("경기 덱"), `value`·`total`(숫자는 두 자리로 맞춤, `pad:false`로 끔), `progress`(false면 진행 바 숨김), `chips`(문자열 또는 `{label, soft}`), children.
- 바탕 `brand`, 글자·진행 바 `on-brand`. 큰 숫자는 `num-hero`(Poppins 112px)이다. 그림자 숫자는 깔지 않는다.
- 아래 모서리 `radius-xl`(32px). 화면당 하나.
