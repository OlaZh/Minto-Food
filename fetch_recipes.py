import requests
from supabase import create_client
from bs4 import BeautifulSoup

SUPABASE_URL = "https://xpaibteyntflrixmigfx.supabase.co"
SUPABASE_KEY = "sb_publishable_5aziCmaq0rxAJ24MznPycw_eY5iVZxZ"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

API_KEY = ""




# --- helper: очистити HTML з інструкцій ---

def clean_html(html):

    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")
    return soup.get_text(separator="\n")


# --- STEP 1: знайти рецепти ---

def fetch_recipes():

    url = "https://api.spoonacular.com/recipes/complexSearch"

    params = {
        "includeIngredients": "carrot",
        "number": 10,
        "sort": "popularity",
        "apiKey": API_KEY
    }

    response = requests.get(url, params=params)
    data = response.json()

    return data.get("results", [])


# --- STEP 2: отримати повний рецепт ---

def get_recipe_information(recipe_id):

    url = f"https://api.spoonacular.com/recipes/{recipe_id}/information"

    params = {
        "apiKey": API_KEY
    }

    response = requests.get(url, params=params)
    return response.json()


# --- STEP 3: зберегти рецепт ---

def save_recipe(recipe):

    recipe_id = recipe.get("id")

    if not recipe_id:
        return

    full_recipe = get_recipe_information(recipe_id)

    title = full_recipe.get("title", "").lower()

    # перевірка: у назві рецепта має бути carrot
    if "carrot" not in title:
        return

    ingredients = []

    for ing in full_recipe.get("extendedIngredients", []):

        name = ing.get("name")

        if not name:
            continue

        # прибираємо дивні інгредієнти
        if "topping" in name:
            continue

        ingredients.append({
            "name": name,
            "amount": ing.get("amount"),
            "unit": ing.get("unit")
        })

    # якщо інгредієнтів немає — пропускаємо рецепт
    if not ingredients:
        return

    record = {
        "title": full_recipe.get("title"),
        "image": full_recipe.get("image"),
        "source": "spoonacular",
        "ready_in_minutes": full_recipe.get("readyInMinutes"),
        "servings": full_recipe.get("servings"),
        "ingredients": ingredients,
        "instructions": clean_html(full_recipe.get("instructions"))
    }

    supabase.table("recipetest").insert(record).execute()


# --- MAIN ---

recipes = fetch_recipes()

for recipe in recipes:
    save_recipe(recipe)

print("DONE")
