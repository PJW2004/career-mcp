from fastmcp import FastMCP
from tavily import TavilyClient
# https://docs.tavily.com/welcome#extract-webpages

import dotenv
dotenv.load_dotenv()
import os
import json

tavily_client = TavilyClient(api_key=os.getenv("TIVILY_TOKEN"))

mcp = FastMCP(name="CareerSearchMCPServer")

@mcp.tool
def wanted_search(context:str) -> dict:
    response = tavily_client.search(f"site:wanted.co.kr {context}")
    # result = json.dumps(response)
    # return result
    return response

@mcp.tool
def jobkorea_search(context:str) -> dict:
    response = tavily_client.search(f"site:jobkorea.co.kr {context}")
    # result = json.dumps(response)
    # return result
    return response

if __name__ == "__main__":
    mcp.run()