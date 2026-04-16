import requests

url = "https://api.insee.fr/entreprises/sirene/V3/siren"

print("Test connexion API SIRENE")
response = requests.get(url)

print(response.status_code)
print(response.text[:500])


