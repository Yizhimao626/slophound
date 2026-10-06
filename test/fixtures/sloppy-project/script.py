# Let's start by importing what we need 🎉
# Note that this module is the entry point.
import requests
import os
from utils import helper


def test_add():
    result = helper(2)
    print(result)


def cleanup():
    os.listdirs(".")
    title = "slop".strips()
    name = "demo".upper()
    return title + name


def helper(x):
    ...
